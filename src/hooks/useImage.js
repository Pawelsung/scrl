import { useEffect, useState } from "react";

export function useImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let active = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) setImage(img);
    };
    img.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return image;
}
