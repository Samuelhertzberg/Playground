import { useState } from "react";
import Gallery, { Project } from "./gallery/Gallery";
import "./App.css";
import { Box, Button, Stack, ThemeProvider, createTheme } from "@mui/material";
import SystemSeeder from "./systemSeeder/SystemSeeder";
import Boids from "./boids/Boids";
import Propagation from "./propagation/Propagation";

function App() {
  const [activeProject, setActiveProject] = useState<string>();

  const projects: Project[] = [
    {
      id: "systemSeeder",
      title: "System Seeder",
      description:
        "Watch gravity do its thing and play around with the formation of star systems!",
      importance: 3,
    },

    // {
    //   title: "Color Wave",
    //   description: "I sure hope you like pretty colors and sine waves!",
    //   importance: 2,
    // },
    // {
    //   title: "Maze Solver",
    //   description:
    //     "Do you hate solving mazes but love pathfinding algorithms? Click here, you nerd.",
    //     importance: 2,
    // },
    {
      id: "boids",
      title: "Boids",
      description:
        "These boids look oddly repulsive. Click if you like worms I guess.",
      importance: 2,
    },
    // {
    //   title: "Circuit",
    //   description:
    //     "Watch the computer race it out on the track of your making.",
    //     importance: 2,
    // },
    // { title: "Growth", description: "The tree must grow, looks icky", importance: 1 },
    // {
    //   title: "Ripples",
    //   description: "Play around with waves, it's somewhat relaxing",
    //   importance: 1,
    // },
    // {
    //   title: "Wordle Solver",
    //   description: "If you're a cheater look no further.",
    //   importance: 2,
    // },
    {
      id: "propagation",
      title: "Propagation",
      description: "Some sort of cloth simulation I think.",
      importance: 2,
    },
    // { title: "Pillar Run", description: "I am a red ball and I must explore.", importance: 2},
  ];

  const darkTheme = createTheme({
    palette: {
      mode: "dark",
    },
  });

  const getActiveProject = () => {
    switch (activeProject) {
      case 'systemSeeder':
        return <SystemSeeder />;
      case 'boids':
        return <Boids />;
      case 'propagation':
        return <Propagation />;

      default:
        return (
          <Stack
            sx={{ height: "100vh" }}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            Not yet migrated :(
          </Stack>
        );
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{
        p: 0,
        m: 0,
        position: "relative",
      }}>

        <Button
          onClick={() => setActiveProject(undefined)}
          sx={{
            position: "absolute",
            top: "10px",
            left: "10px",
            display: activeProject === undefined ? "none" : "block",
          }}
        >
          Back
        </Button>
        {activeProject === undefined && (
          <Gallery projects={projects} onClickProject={setActiveProject} />
        )}
        {activeProject !== undefined && getActiveProject()}
      </Box>
    </ThemeProvider>
  );
}

export default App;
