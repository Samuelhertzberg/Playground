import { Box, Slider, Button } from '@mui/material';
import { useState } from 'react';

type SeedingValues = {
    maxR: number;
    rotationFactor: number;
    numberOfBodies: number;
    gravityConstant: number;
};

type Props = {
    SeedingValues: SeedingValues,
    setSeedingValues: (values: SeedingValues) => void;
};


const Menu = ({ SeedingValues, setSeedingValues }: Props) => {
    const [maxRInEdit, setMaxRInEdit] = useState(SeedingValues.maxR);
    const [rotateFactorInEdit, setRotateFactorInEdit] = useState(SeedingValues.rotationFactor);
    const [numberOfBodiesInEdit, setNumberOfBodiesInEdit] = useState(SeedingValues.numberOfBodies);
    const [gravityConstantInEdit, setGravityConstantInEdit] = useState(SeedingValues.gravityConstant);

    const onSave = () => {
        setSeedingValues({
            maxR: maxRInEdit,
            rotationFactor: rotateFactorInEdit,
            numberOfBodies: numberOfBodiesInEdit,
            gravityConstant: gravityConstantInEdit,
        });
    }

    const onCancel = () => {
        setMaxRInEdit(SeedingValues.maxR);
        setRotateFactorInEdit(SeedingValues.rotationFactor);
        setNumberOfBodiesInEdit(SeedingValues.numberOfBodies);
        setGravityConstantInEdit(SeedingValues.gravityConstant);
    }


    return (<Box sx={{
        position: "absolute",
        m: 4,
        right: 0,
        width: "200px",

    }}>
        Cloud Size
        <Slider value={maxRInEdit} onMouseDown={e => e.stopPropagation()} onChange={(_, v) => { setMaxRInEdit(v as number) }} min={100} max={2000} />
        Cloud Rotation Rate
        <Slider value={rotateFactorInEdit} onMouseDown={e => e.stopPropagation()} onChange={(_, v) => { setRotateFactorInEdit(v as number) }} min={0} max={1} step={0.01} />
        Number of Bodies
        <Slider value={numberOfBodiesInEdit} onMouseDown={e => e.stopPropagation()} onChange={(_, v) => { setNumberOfBodiesInEdit(v as number) }} min={3} max={2000} />
        Gravity Constant
        <Slider value={gravityConstantInEdit} onMouseDown={e => e.stopPropagation()} onChange={(_, v) => { setGravityConstantInEdit(v as number) }} min={0} max={0.01} step={0.0001} />
        <Button onClick={onSave} >
            Save
        </Button>
        <Button onClick={onCancel} >
            Cancel
        </Button>
    </Box>);
};

export default Menu;
export type { SeedingValues };