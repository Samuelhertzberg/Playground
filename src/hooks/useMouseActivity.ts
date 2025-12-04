import { useState, useEffect, useCallback } from "react";

const useMouseActivity = (fadeDelay = 2000, minOpacity = 0) => {
  const [opacity, setOpacity] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const handleMouseActivity = useCallback(() => {
    setOpacity(1);
    setIsActive(true);
  }, []);

  useEffect(() => {
    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setOpacity(minOpacity);
        setIsActive(false);
      }, fadeDelay) as unknown as number;
    };

    const onMouseMove = () => {
      handleMouseActivity();
      resetTimer();
    };

    window.addEventListener('mousemove', onMouseMove);
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fadeDelay, minOpacity, handleMouseActivity]);

  return { opacity, isActive };
};

export default useMouseActivity;
