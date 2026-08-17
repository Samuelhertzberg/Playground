const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
};

const scale = (value: number, min: number, max: number, newMin: number, newMax: number) => {
    return ((value - min) / (max - min)) * (newMax - newMin) + newMin;
}

export { clamp, scale};