import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(projectRoot, 'metadata.geojson');
const samplesDirectory = path.join(projectRoot, 'public', 'samples');
const outputPath = path.join(samplesDirectory, 'metadata.json');

const LAMBERT_93 =
    '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 ' +
    '+x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs +type=crs';
const WGS_84 = 'EPSG:4326';
const SAMPLE_FILENAME_PATTERN = /^S2_(\d+)\.npy$/i;

function roundCoordinate(value) {
    return Number(value.toFixed(6));
}

function transformCoordinates(coordinates) {
    if (typeof coordinates[0] === 'number') {
        const [longitude, latitude] = proj4(LAMBERT_93, WGS_84, coordinates);
        return [roundCoordinate(longitude), roundCoordinate(latitude)];
    }

    return coordinates.map(transformCoordinates);
}

function getBounds(coordinates, bounds = [Infinity, Infinity, -Infinity, -Infinity]) {
    if (typeof coordinates[0] === 'number') {
        bounds[0] = Math.min(bounds[0], coordinates[0]);
        bounds[1] = Math.min(bounds[1], coordinates[1]);
        bounds[2] = Math.max(bounds[2], coordinates[0]);
        bounds[3] = Math.max(bounds[3], coordinates[1]);
        return bounds;
    }

    for (const child of coordinates) {
        getBounds(child, bounds);
    }
    return bounds;
}

const sampleFiles = (await readdir(samplesDirectory))
    .filter((filename) => SAMPLE_FILENAME_PATTERN.test(filename))
    .sort();
const sampleByPatchId = new Map(
    sampleFiles.map((filename) => [
        Number(filename.match(SAMPLE_FILENAME_PATTERN)[1]),
        filename,
    ])
);

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const features = [];

for (const feature of source.features) {
    const patchId = Number(feature.properties.ID_PATCH);
    const sampleFilename = sampleByPatchId.get(patchId);
    if (!sampleFilename) continue;

    const coordinates = transformCoordinates(feature.geometry.coordinates);
    const bounds = getBounds(coordinates);
    const dates = feature.properties['dates-S2'] ?? {};

    features.push({
        type: 'Feature',
        id: patchId,
        properties: {
            sampleFilename,
            patchId,
            tile: feature.properties.TILE,
            fold: feature.properties.Fold,
            acquisitionCount: Object.keys(dates).length,
            centroid: [
                roundCoordinate((bounds[0] + bounds[2]) / 2),
                roundCoordinate((bounds[1] + bounds[3]) / 2),
            ],
        },
        geometry: {
            type: feature.geometry.type,
            coordinates,
        },
    });
}

features.sort((left, right) => left.properties.patchId - right.properties.patchId);

if (features.length !== sampleByPatchId.size) {
    const foundIds = new Set(features.map((feature) => feature.properties.patchId));
    const missing = [...sampleByPatchId.keys()].filter((patchId) => !foundIds.has(patchId));
    throw new Error(`Missing metadata for sample patch IDs: ${missing.join(', ')}`);
}

const output = {
    type: 'FeatureCollection',
    crs: 'EPSG:4326',
    generatedFrom: 'metadata.geojson',
    features,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Wrote ${features.length} sample locations to ${path.relative(projectRoot, outputPath)}`);
