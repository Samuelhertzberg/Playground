import { IconButton } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const BackButton = () => {
  const navigate = useNavigate();
  const [opacity, setOpacity] = useState(0.3);
  const [mouseActivityTimer, setMouseActivityTimer] = useState<number | null>(null);

  const handleMouseActivity = () => {
    setOpacity(1);

    if (mouseActivityTimer) {
      clearTimeout(mouseActivityTimer);
    }

    const timer = setTimeout(() => {
      setOpacity(0.3);
    }, 2000) as unknown as number;

    setMouseActivityTimer(timer);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseActivity);

    return () => {
      window.removeEventListener('mousemove', handleMouseActivity);
      if (mouseActivityTimer) {
        clearTimeout(mouseActivityTimer);
      }
    };
  }, [mouseActivityTimer]);

  return (
    <IconButton
      onClick={() => navigate("/")}
      sx={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 999,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        color: "white",
        fontSize: "20px",
        width: "36px",
        height: "36px",
        opacity: opacity,
        transition: "opacity 0.3s ease",
        "&:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          opacity: 1,
        },
      }}
      title="Back to Gallery"
    >
      ←
    </IconButton>
  );
};

export default BackButton;
