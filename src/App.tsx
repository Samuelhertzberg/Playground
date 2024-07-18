import { useState } from 'react'
import List, { Project } from './list/List'
import './App.css'
import { Box, Button, Stack, ThemeProvider, createTheme } from '@mui/material'
import SystemSeeder from './systemSeeder/SystemSeeder'
import Boids from './boids/Boids'

function App() {

  const [activeProject, setActiveProject] = useState<number>()

  const projects: Project[] = [
    { title: "System Seeder", description: "Watch gravity do its thing and play around with the formation of star systems!" },
    { title: "Color Wave", description: "I sure hope you like pretty colors and sine waves!" },
    { title: "Maze Solver", description: "Do you hate solving mazes but love pathfinding algorithms? Click here, you nerd." },
    { title: "Boids", description: "These boids look oddly repulsive. Click if you like worms I guess." },
    { title: "Circuit", description: "Watch the computer race it out on the track of your making." },
    { title: "Particle Collider", description: "Smash virtual particles together at incredible speeds! Why? Please don't ask those questions on this page." },
    { title: "Intro Screen", description: "\"That intro screen sure looked nice, Samuel! I would like to see it again please!\" \n-You probably" },
    { title: "Growth", description: "The tree must grow, looks icky" },
    { title: "Ripples", description: "Play around with waves, it's somewhat relaxing" },
    { title: "Wordle Solver", description: "If you're a cheater look no further." },
    { title: "Propagation", description: "Some sort of cloth simulation I think." },
    { title: "Pillar Run", description: "I am a red ball and I must explore." },
  ]

  const onClickProject = (i: number) => {
    setActiveProject(i)
  }

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const notMigratedMessage = (
    <Stack sx={{height: "100vh"}} display='flex' justifyContent='center' alignItems='center'>
          Not yet migrated :(
        </Stack>
  )

  const getActiveProject = () => {
    switch (activeProject) {
      case 0:
        return <SystemSeeder />
      case 1:
        return notMigratedMessage
      case 2:
        return notMigratedMessage
      case 3:
        return <Boids />
      case 4:
        return notMigratedMessage
      case 5:
        return notMigratedMessage
      case 6:
        return notMigratedMessage
      case 7:
        return notMigratedMessage
      case 8:
        return notMigratedMessage
      case 9:
        return notMigratedMessage
      case 10:
        return notMigratedMessage
      case 11:
        return notMigratedMessage
      default:
        return notMigratedMessage
    }
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{
        backgroundColor: "black",
        m: 0,
        p: 0,
        height: '100vh'
      }}>
        <Button onClick={() => setActiveProject(undefined)}
          sx={{
            position: "absolute",
            top: "10px",
            left: "10px"
          }}
        >
          Back
        </Button>
        {activeProject === undefined && (
          <List projects={projects} onClickProject={onClickProject} />
        )}
        {activeProject !== undefined && getActiveProject()}
      </Box>
    </ThemeProvider>
  )
}

export default App
