"""Remove TensorList Flex ops by statically unrolling this model's ConvLSTM.

The source model's recurrent cell already uses TFLite built-in math. Only its
TensorArray bookkeeping is emitted as Select/Flex ops. Because the model has a
fixed 61-step input, the loop can be expanded without changing its weights.
"""

from __future__ import annotations

import argparse
import copy
from pathlib import Path

import flatbuffers
import numpy as np
from tensorflow.lite.python import schema_py_generated as schema


FLEX_PREFIX = b"FlexTensorList"


def opcode_name(model, opcode_index: int) -> tuple[int, bytes]:
    code = model.operatorCodes[opcode_index]
    return code.builtinCode, code.customCode or b""


def append_tensor(subgraph, tensor, name: bytes) -> int:
    cloned = copy.deepcopy(tensor)
    cloned.name = name
    subgraph.tensors.append(cloned)
    return len(subgraph.tensors) - 1


def append_int32_scalar(model, subgraph, value: int, name: bytes) -> int:
    buffer = schema.BufferT()
    buffer.data = np.frombuffer(np.int32(value).tobytes(), dtype=np.uint8)
    model.buffers.append(buffer)

    tensor = schema.TensorT()
    tensor.shape = np.asarray([], dtype=np.int32)
    tensor.type = schema.TensorType.INT32
    tensor.buffer = len(model.buffers) - 1
    tensor.name = name
    tensor.isVariable = False
    tensor.hasRank = True
    subgraph.tensors.append(tensor)
    return len(subgraph.tensors) - 1


def append_int32_vector(model, subgraph, values, name: bytes) -> int:
    values = np.asarray(values, dtype=np.int32)
    buffer = schema.BufferT()
    buffer.data = np.frombuffer(values.tobytes(), dtype=np.uint8)
    model.buffers.append(buffer)

    tensor = schema.TensorT()
    tensor.shape = np.asarray([len(values)], dtype=np.int32)
    tensor.type = schema.TensorType.INT32
    tensor.buffer = len(model.buffers) - 1
    tensor.name = name
    tensor.isVariable = False
    tensor.hasRank = True
    subgraph.tensors.append(tensor)
    return len(subgraph.tensors) - 1


def transform(source: Path, destination: Path) -> None:
    source_bytes = source.read_bytes()
    source_model = schema.Model.GetRootAsModel(source_bytes, 0)
    model = schema.ModelT.InitFromObj(source_model)

    if len(model.subgraphs) < 3:
        raise RuntimeError("Expected a main graph plus ConvLSTM condition/body graphs")

    main = model.subgraphs[0]
    flex_operator_indexes = [
        index
        for index, operator in enumerate(main.operators)
        if opcode_name(model, operator.opcodeIndex)[1].startswith(FLEX_PREFIX)
    ]
    if len(flex_operator_indexes) != 2:
        raise RuntimeError(
            f"Expected reserve/stack Flex ops in the main graph, found {flex_operator_indexes}"
        )

    reserve_index, stack_index = flex_operator_indexes
    while_index = next(
        index
        for index in range(reserve_index + 1, stack_index)
        if opcode_name(model, main.operators[index].opcodeIndex)[0]
        == schema.BuiltinOperator.WHILE
    )
    slice_index = stack_index + 1

    reserve_operator = main.operators[reserve_index]
    while_operator = main.operators[while_index]
    stack_operator = main.operators[stack_index]
    slice_operator = main.operators[slice_index]

    if len(while_operator.inputs) != 6 or len(while_operator.outputs) != 6:
        raise RuntimeError("Unexpected ConvLSTM while-loop signature")
    if stack_operator.inputs[0] != while_operator.outputs[2]:
        raise RuntimeError("TensorList stack is not connected to the recurrent loop")
    if slice_operator.inputs[0] != stack_operator.outputs[0]:
        raise RuntimeError("Expected the final-state slice immediately after TensorList stack")

    while_options = while_operator.builtinOptions
    body = model.subgraphs[while_options.bodySubgraphIndex]
    sequence_length_tensor = main.tensors[reserve_operator.inputs[1]]
    sequence_buffer = model.buffers[sequence_length_tensor.buffer].data
    sequence_length = int(np.frombuffer(sequence_buffer.tobytes(), dtype=np.int32)[0])
    if sequence_length <= 0:
        raise RuntimeError(f"Invalid sequence length: {sequence_length}")

    # Body input/output positions are the six loop variables:
    # counter, time index, TensorList, hidden state, cell state, input sequence.
    if len(body.inputs) != 6 or len(body.outputs) != 6:
        raise RuntimeError("Unexpected ConvLSTM body signature")
    if body.tensors[body.inputs[2]].type != schema.TensorType.VARIANT:
        raise RuntimeError("Third loop variable is not the TensorList handle")

    counter_outputs = {body.outputs[0], body.outputs[1]}
    body_operators = []
    for operator in body.operators:
        _, custom_code = opcode_name(model, operator.opcodeIndex)
        if custom_code.startswith(FLEX_PREFIX):
            continue
        if counter_outputs.intersection(int(output) for output in operator.outputs):
            continue
        body_operators.append(operator)

    # Clone recurrent weights/scalars from the body into the main graph once.
    constant_mapping: dict[int, int] = {}

    def map_constant(body_tensor_index: int) -> int:
        if body_tensor_index in constant_mapping:
            return constant_mapping[body_tensor_index]
        tensor = body.tensors[body_tensor_index]
        buffer_data = model.buffers[tensor.buffer].data
        if buffer_data is None or len(buffer_data) == 0:
            raise RuntimeError(
                f"Body tensor {body_tensor_index} ({tensor.name!r}) is not a constant"
            )
        mapped = append_tensor(main, tensor, b"browser_unroll/constant/" + tensor.name)
        constant_mapping[body_tensor_index] = mapped
        return mapped

    initial_hidden = int(while_operator.inputs[3])
    initial_cell = int(while_operator.inputs[4])
    input_sequence = int(while_operator.inputs[5])
    current_hidden = initial_hidden
    current_cell = initial_cell
    unrolled_operators = []

    for step in range(sequence_length):
        step_index = append_int32_scalar(
            model,
            main,
            step,
            f"browser_unroll/step_{step:02d}".encode(),
        )
        tensor_mapping: dict[int, int] = {
            int(body.inputs[0]): step_index,
            int(body.inputs[1]): step_index,
            int(body.inputs[3]): current_hidden,
            int(body.inputs[4]): current_cell,
            int(body.inputs[5]): input_sequence,
        }

        for body_operator in body_operators:
            operator = copy.deepcopy(body_operator)
            mapped_inputs = []
            for body_input in body_operator.inputs:
                body_input = int(body_input)
                if body_input < 0:
                    mapped_inputs.append(body_input)
                elif body_input in tensor_mapping:
                    mapped_inputs.append(tensor_mapping[body_input])
                else:
                    mapped_inputs.append(map_constant(body_input))

            mapped_outputs = []
            for body_output in body_operator.outputs:
                body_output = int(body_output)
                mapped_output = append_tensor(
                    main,
                    body.tensors[body_output],
                    f"browser_unroll/step_{step:02d}/".encode()
                    + body.tensors[body_output].name,
                )
                tensor_mapping[body_output] = mapped_output
                mapped_outputs.append(mapped_output)

            operator.inputs = np.asarray(mapped_inputs, dtype=np.int32)
            operator.outputs = np.asarray(mapped_outputs, dtype=np.int32)
            unrolled_operators.append(operator)

        current_hidden = tensor_mapping[int(body.outputs[3])]
        current_cell = tensor_mapping[int(body.outputs[4])]

    final_state_tensor = int(slice_operator.outputs[0])

    # Keep initial-state construction, replace loop/list/slice with expanded math,
    # and redirect every downstream consumer to the last hidden state.
    prefix = (
        main.operators[:reserve_index]
        + main.operators[reserve_index + 1 : while_index]
    )
    suffix = main.operators[slice_index + 1 :]
    for operator in suffix:
        operator.inputs = np.asarray(
            [current_hidden if int(value) == final_state_tensor else int(value) for value in operator.inputs],
            dtype=np.int32,
        )
    main.operators = prefix + unrolled_operators + suffix

    # The loop subgraphs and Flex opcodes are now unreachable; remove them so a
    # browser runtime never attempts to register unsupported custom kernels.
    model.subgraphs = [main]
    retained_codes = []
    opcode_mapping: dict[int, int] = {}
    for old_index, code in enumerate(model.operatorCodes):
        if (code.customCode or b"").startswith(FLEX_PREFIX):
            continue
        opcode_mapping[old_index] = len(retained_codes)
        retained_codes.append(code)
    model.operatorCodes = retained_codes
    for operator in main.operators:
        operator.opcodeIndex = opcode_mapping[int(operator.opcodeIndex)]

    # Tensor indices from the removed WHILE/TensorList chain remain in the
    # flatbuffer even though no operator references them. LiteRT.js validates
    # every tensor while loading and rejects the orphaned VARIANT element type,
    # so normalize only those unreachable handles to an inert supported tensor.
    referenced_tensors = {
        int(tensor_index)
        for tensor_index in [*main.inputs, *main.outputs]
        if int(tensor_index) >= 0
    }
    for operator in main.operators:
        referenced_tensors.update(
            int(tensor_index)
            for tensor_index in [
                *operator.inputs,
                *operator.outputs,
                *(operator.intermediates or []),
            ]
            if int(tensor_index) >= 0
        )
    for tensor_index, tensor in enumerate(main.tensors):
        if tensor.type == schema.TensorType.VARIANT:
            if tensor_index in referenced_tensors:
                raise RuntimeError(
                    f"Reachable VARIANT tensor remains after unrolling: {tensor_index}"
                )
            tensor.type = schema.TensorType.FLOAT32
            tensor.shape = np.asarray([], dtype=np.int32)
            tensor.buffer = 0
            tensor.name = b"browser_unroll/removed_tensorlist_handle"
            tensor.isVariable = False
            tensor.hasRank = True
            tensor.variantTensors = None
        # This browser artifact has a fixed batch and spatial/temporal shape.
        # Remove converter-carried `-1` batch signatures so LiteRT delegates do
        # not classify otherwise-static convolution outputs as dynamic tensors.
        if tensor.shapeSignature is not None:
            tensor.shapeSignature = np.asarray(tensor.shape, dtype=np.int32)

    # Keras emitted decoder output shapes through SHAPE/SLICE/PACK chains.
    # They are constant for this fixed-shape artifact, but leaving them as
    # runtime values makes TRANSPOSE_CONV outputs dynamically allocated and
    # prevents browser CPU/GPU delegates from accepting those layers.
    transpose_conv_shapes: dict[tuple[int, ...], int] = {}
    for operator in main.operators:
        builtin_code, _ = opcode_name(model, int(operator.opcodeIndex))
        if builtin_code != schema.BuiltinOperator.TRANSPOSE_CONV:
            continue
        output_shape = tuple(int(value) for value in main.tensors[int(operator.outputs[0])].shape)
        if output_shape not in transpose_conv_shapes:
            transpose_conv_shapes[output_shape] = append_int32_vector(
                model,
                main,
                output_shape,
                b"browser_static/transpose_conv_output_shape",
            )
        operator.inputs[0] = transpose_conv_shapes[output_shape]

    builder = flatbuffers.Builder(0)
    builder.Finish(model.Pack(builder), file_identifier=b"TFL3")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(builder.Output())

    output_bytes = destination.read_bytes()
    if FLEX_PREFIX in output_bytes:
        raise RuntimeError("Transformed model still contains Flex TensorList operators")
    print(
        f"Wrote {destination} ({len(output_bytes):,} bytes, "
        f"{sequence_length} recurrent steps unrolled)"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    transform(args.source, args.destination)


if __name__ == "__main__":
    main()
