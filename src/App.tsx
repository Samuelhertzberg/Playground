import Gallery, { Project } from "./gallery/Gallery";
import "./App.css";
import { Box, ThemeProvider, createTheme } from "@mui/material";
import GravitySimulator from "./gravitySimulator/GravitySimulator";
import Boids from "./boids/Boids";
import Propagation from "./propagation/Propagation";
import Circuit from "./circuit/Circuit";
import Stream from "./stream/Stream";
import Harmonics from "./harmonics/Harmonics";
import { HashRouter, Routes, Route } from "react-router-dom";

function App() {

  const projects: Project[] = [
    {
      id: "gravitySimulator",
      title: "Gravity Simulator",
      description:
        "Watch gravity do its thing and play around with the formation of star systems!",
      importance: 3,
      route: "/gravity-simulator",
    },
    {
      id: "harmonics",
      title: "Harmonics",
      description:
        "Mesmerizing harmonic oscillations with multiple visualization modes!",
      importance: 3,
      route: "/harmonics",
    },
    {
      id: "boids",
      title: "Boids",
      description:
        "These boids look oddly repulsive. Click if you like worms I guess.",
      importance: 2,
      route: "/boids",
    },
    {
      id: "propagation",
      title: "Propagation",
      description: "Create beautiful wave patterns with your cursor!",
      importance: 2,
      route: "/propagation",
    },
  ];

  const darkTheme = createTheme({
    palette: {
      mode: "dark",
    },
  });

  return (
    <ThemeProvider theme={darkTheme}>
      <HashRouter>
        <Box sx={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}>
          <Routes>
            <Route path="/" element={<Gallery projects={projects} />} />
            <Route path="/gravity-simulator" element={<GravitySimulator />} />
            <Route path="/harmonics" element={<Harmonics />} />
            <Route path="/boids" element={<Boids />} />
            <Route path="/propagation" element={<Propagation />} />
            <Route path="/circuit" element={<Circuit />} />
            <Route path="/stream" element={<Stream />} />
          </Routes>
        </Box>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
