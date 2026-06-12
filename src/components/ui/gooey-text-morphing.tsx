"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  className?: string;
  textClassName?: string;
}

export function GooeyText({
  texts,
  morphTime = 1.5,
  cooldownTime = 0.5,
  className,
  textClassName
}: GooeyTextProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, (morphTime + cooldownTime) * 1000);
    return () => clearInterval(interval);
  }, [texts.length, morphTime, cooldownTime]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className || ""}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, filter: "blur(12px)", y: 15 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(12px)", y: -15 }}
          transition={{ duration: morphTime / 2, ease: "easeInOut" }}
          className={`absolute text-center text-4xl md:text-6xl text-[#D7FF67] font-bold ${textClassName || ''}`}
        >
          {texts[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
