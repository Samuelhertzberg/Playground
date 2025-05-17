import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber'
import Tile from './Tile';
import { OrbitControls } from '@react-three/drei';
import getWordsAsBitMap from './words';
import { useInterval } from 'react-interval-hook';

const xTiles = 80
const yTiles = 13

const testWords = [
    'HELLO THERE!',
    'WELCOME',
    'I AM SAMUEL',
    'SPACE NERD,',
    'PROGRAMMER,',
    '& CREATOR',
    'ENJOY...',


].map(getWordsAsBitMap)



const getInitialTimes = () => {
    const tiles = []
    for (let x = 0; x < xTiles; x++) {
        for (let y = 0; y < yTiles; y++) {
            tiles.push({
                position: [x - xTiles / 2, y, Math.random() * 0.1] as [number, number, number],
                index: { x, y },
                active: false
            })
        }
    }
    return tiles
}


const Intro: React.FC = () => {
    const [tiles, setTiles] = useState(getInitialTimes())
    const [wavePosition, setWavePosition] = useState<[number, number]>()
    const [wordIndex, setWordIndex] = useState(testWords.length - 1)

    const { stop } = useInterval(() => {
        if (wavePosition) {
            setWavePosition(undefined)
        } else {
            setWordIndex((wordIndex + 1) % testWords.length)
            setWavePosition([-50, 0])
        }
    }, 2500)

    const onClick = (i: number) => {
        const [x, y] = tiles[i].position
        setWavePosition([x, y])
        setWordIndex((wordIndex + 1) % testWords.length)

    }

    const word = testWords[wordIndex]

    return (
        <Canvas style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "white",
        }}
            camera={{
                position: [0, 0, 20],
                rotation: [0, 0, 0],
                fov: 100,

            }}
            shadows
        >
            {/* <ambientLight intensity={0.1} /> */}
            <ambientLight intensity={0.5} />
            <directionalLight castShadow position={[100, 100, 100]} intensity={10} shadow-mapSize={1024}>
                <orthographicCamera attach="shadow-camera" args={[-40, 40, -20, 30, 0.1, 300]}/>
            </directionalLight>
            <OrbitControls />
            {
                tiles.map((tile, i) => {
                    let delay = -1
                    if (wavePosition) {
                        delay = Math.sqrt(Math.pow(wavePosition[0] - tile.position[0], 2) + Math.pow(wavePosition[1] - tile.position[1], 2)) * 10
                    }
                    return (
                        <Tile
                            {...tile}
                            key={`tile-${i}`}
                            onClick={() => onClick(i)}
                            delay={delay}
                            active={word[tile.index.y][tile.index.x] === '█'}
                        />)
                })
            }
            <fog attach="fog" args={["white", 0, 40]} />
        </Canvas>
    );
};

export default Intro;