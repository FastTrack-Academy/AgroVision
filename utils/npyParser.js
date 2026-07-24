/**
 * Pure JavaScript parser for NumPy .npy binary tensor files.
 */
export function parseNpy(buffer) {
    const uint8 = new Uint8Array(buffer);
    
    // Check magic header "\x93NUMPY"
    if (uint8[0] !== 0x93 || uint8[1] !== 0x4e || uint8[2] !== 0x55 ||
        uint8[3] !== 0x4d || uint8[4] !== 0x50 || uint8[5] !== 0x59) {
        throw new Error("Invalid .npy file format");
    }

    const majorVersion = uint8[6];
    let headerLen = 0;
    let headerOffset = 0;
    let dataOffset = 0;

    if (majorVersion === 1) {
        headerLen = uint8[8] | (uint8[9] << 8);
        headerOffset = 10;
    } else if (majorVersion === 2 || majorVersion === 3) {
        headerLen = new DataView(buffer).getUint32(8, true);
        headerOffset = 12;
    } else {
        throw new Error(`Unsupported .npy version: ${majorVersion}`);
    }
    dataOffset = headerOffset + headerLen;

    const decoder = new TextDecoder('ascii');
    const headerStr = decoder.decode(uint8.subarray(headerOffset, dataOffset));

    // Parse shape: e.g., (61, 128, 128, 10)
    const shapeMatch = headerStr.match(/'shape':\s*\(([^)]*)\)/);
    if (!shapeMatch) throw new Error("Could not parse shape from .npy header");
    
    const shape = shapeMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(Number);

    // Parse descr: e.g. '<f4', '>f4', '<f8'
    const descrMatch = headerStr.match(/'descr':\s*'([^']+)'/);
    if (!descrMatch) throw new Error("Could not parse dtype from .npy header");
    const descr = descrMatch[1];

    const fortranMatch = headerStr.match(/'fortran_order':\s*(True|False)/);
    if (fortranMatch?.[1] === 'True') {
        throw new Error("Fortran-ordered .npy arrays are not supported");
    }

    const dtypeMatch = descr.match(/^([<>=|])([fiu])([1248])$/);
    if (!dtypeMatch) throw new Error(`Unsupported NumPy dtype: ${descr}`);

    const [, endian, kind, byteWidthText] = dtypeMatch;
    const byteWidth = Number(byteWidthText);
    const elementCount = shape.reduce((total, dimension) => total * dimension, 1);
    const expectedBytes = elementCount * byteWidth;
    const availableBytes = buffer.byteLength - dataOffset;
    if (availableBytes !== expectedBytes) {
        throw new Error(
            `Tensor byte size mismatch: shape requires ${expectedBytes} bytes, file contains ${availableBytes}`
        );
    }

    const littleEndian = endian !== '>';
    const view = new DataView(buffer, dataOffset, expectedBytes);
    const data = new Float32Array(elementCount);

    for (let i = 0; i < elementCount; i++) {
        const offset = i * byteWidth;
        if (kind === 'f' && byteWidth === 4) data[i] = view.getFloat32(offset, littleEndian);
        else if (kind === 'f' && byteWidth === 8) data[i] = view.getFloat64(offset, littleEndian);
        else if (kind === 'i' && byteWidth === 1) data[i] = view.getInt8(offset);
        else if (kind === 'i' && byteWidth === 2) data[i] = view.getInt16(offset, littleEndian);
        else if (kind === 'i' && byteWidth === 4) data[i] = view.getInt32(offset, littleEndian);
        else if (kind === 'u' && byteWidth === 1) data[i] = view.getUint8(offset);
        else if (kind === 'u' && byteWidth === 2) data[i] = view.getUint16(offset, littleEndian);
        else if (kind === 'u' && byteWidth === 4) data[i] = view.getUint32(offset, littleEndian);
        else throw new Error(`Unsupported NumPy dtype: ${descr}`);
    }

    return { data, shape };
}
