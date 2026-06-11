'use client';

import React, { useRef, useId, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { animate, useMotionValue } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';

function mapRange(
    value: number,
    fromLow: number,
    fromHigh: number,
    toLow: number,
    toHigh: number
): number {
    if (fromLow === fromHigh) {
        return toLow;
    }
    const percentage = (value - fromLow) / (fromHigh - fromLow);
    return toLow + percentage * (toHigh - toLow);
}

const useInstanceId = (): string => {
    const id = useId();
    const cleanId = id.replace(/:/g, "");
    return `animated-bg-${cleanId}`;
};

interface AnimatedBackgroundProps {
    color?: string;
    scale?: number;
    speed?: number;
    noise?: number;
    className?: string;
    style?: CSSProperties;
    children?: React.ReactNode;
}

export function AnimatedBackground({
    color = 'rgba(215, 255, 103, 0.15)',
    scale = 80,
    speed = 70,
    noise = 0.8,
    className = '',
    style = {},
    children
}: AnimatedBackgroundProps) {
    const id = useInstanceId();
    const feColorMatrixRef = useRef<SVGFEColorMatrixElement>(null);
    const hueRotateMotionValue = useMotionValue(180);
    const hueRotateAnimation = useRef<AnimationPlaybackControls | null>(null);

    const displacementScale = mapRange(scale, 1, 100, 20, 100);
    const animationDuration = mapRange(speed, 1, 100, 1000, 50);

    useEffect(() => {
        if (feColorMatrixRef.current && scale > 0) {
            if (hueRotateAnimation.current) {
                hueRotateAnimation.current.stop();
            }
            hueRotateMotionValue.set(0);
            hueRotateAnimation.current = animate(hueRotateMotionValue, 360, {
                duration: animationDuration / 25,
                repeat: Infinity,
                repeatType: "loop",
                repeatDelay: 0,
                ease: "linear",
                delay: 0,
                onUpdate: (value: number) => {
                    if (feColorMatrixRef.current) {
                        feColorMatrixRef.current.setAttribute("values", String(value));
                    }
                }
            });

            return () => {
                if (hueRotateAnimation.current) {
                    hueRotateAnimation.current.stop();
                }
            };
        }
    }, [scale, animationDuration, hueRotateMotionValue]);

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                overflow: 'hidden',
                ...style
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: -displacementScale,
                    filter: scale > 0 ? `url(#${id}) blur(8px)` : 'none',
                    zIndex: 0
                }}
            >
                {scale > 0 && (
                    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                        <defs>
                            <filter id={id}>
                                <feTurbulence
                                    result="undulation"
                                    numOctaves="2"
                                    baseFrequency={`${mapRange(scale, 0, 100, 0.001, 0.0005)},${mapRange(scale, 0, 100, 0.004, 0.002)}`}
                                    seed="0"
                                    type="turbulence"
                                />
                                <feColorMatrix
                                    ref={feColorMatrixRef}
                                    in="undulation"
                                    type="hueRotate"
                                    values="180"
                                />
                                <feColorMatrix
                                    in="dist"
                                    result="circulation"
                                    type="matrix"
                                    values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
                                />
                                <feDisplacementMap
                                    in="SourceGraphic"
                                    in2="circulation"
                                    scale={displacementScale}
                                    result="dist"
                                />
                                <feDisplacementMap
                                    in="dist"
                                    in2="undulation"
                                    scale={displacementScale}
                                    result="output"
                                />
                            </filter>
                        </defs>
                    </svg>
                )}
                <div
                    style={{
                        backgroundColor: color,
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>

            {noise > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
                        backgroundSize: '200px 200px',
                        backgroundRepeat: 'repeat',
                        opacity: noise / 2,
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                />
            )}

            <div style={{ position: 'relative', zIndex: 10 }}>
                {children}
            </div>
        </div>
    );
}
