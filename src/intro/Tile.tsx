import { useSpring, animated, config } from '@react-spring/three';
import React, { useEffect, useState } from 'react';

type Props = {
    position: [number, number, number];
    onClick?: () => void;
    delay: number;
    active?: boolean;
};

const tileHeight = 1
const tileBump = 1.5
const tileNoise = 0.1

const Tile: React.FC<Props> = ({ position, onClick, delay, active }) => {
    const [x, y] = position
    const [statePosition, setStatePosition] = useState(position)

    useEffect(() => {
        if (delay > 0) {
            if (delay) {
                setStatePosition([x, y, tileBump + (active ? 0 : Math.random() * tileNoise)])
            } else {
                setStatePosition([x, y, Math.random() * tileNoise])
            }
            if (!active) {
                setTimeout(() => {
                    setStatePosition(position)
                }, 1000)
            }
        }
    }, [delay, x, y])

    const { animPosition } = useSpring({
        animPosition: (statePosition) as [number, number, number],
        config: {
            ...config.wobbly,
            duration: 100
        },

        delay: delay || 0
    });
    
    return (
        <animated.mesh
            position={animPosition}
            scale={1}
            onClick={onClick}
            castShadow
            receiveShadow
        >
            <boxGeometry
                args={[1, 1, tileHeight]}
            />
            <meshLambertMaterial
            />
        </animated.mesh>
    )
};

export default Tile;
