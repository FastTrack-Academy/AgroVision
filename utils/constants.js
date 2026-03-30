export const NUM_CLASSES = 20;
export const TIME_SERIES_LENGTH = 61;

export const CLASS_NAMES = {
    0: "Background",
    1: "Meadow",
    2: "Soft winter wheat",
    3: "Corn",
    4: "Winter barley",
    5: "Winter rapeseed",
    6: "Spring barley",
    7: "Sunflower",
    8: "Grapevine",
    9: "Beet",
    10: "Winter triticale",
    11: "Winter durum wheat",
    12: "Fruits, vegetables, flowers",
    13: "Potatoes",
    14: "Leguminous fodder",
    15: "Soybeans",
    16: "Orchard",
    17: "Mixed cereal",
    18: "Sorghum",
    19: "Void label",
};

// Extracted from matplotlib tab20 + custom
export const CLASS_COLORS = [
    [0, 0, 0], // 0: black
    [31, 119, 180], // 1
    [174, 199, 232], // 2
    [255, 127, 14], // 3
    [255, 187, 120], // 4
    [44, 160, 44], // 5
    [152, 223, 138], // 6
    [214, 39, 40], // 7
    [255, 152, 150], // 8
    [148, 103, 189], // 9
    [197, 176, 213], // 10
    [140, 86, 75], // 11
    [196, 156, 148], // 12
    [227, 119, 194], // 13
    [247, 182, 210], // 14
    [127, 127, 127], // 15
    [199, 199, 199], // 16
    [188, 189, 34], // 17
    [219, 219, 141], // 18
    [23, 190, 207]  // 19
];
