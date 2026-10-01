"use client";

import { ReactNode, useEffect, useState } from "react";

const backgroundImages = [
    "/pexels-car-1281640_1920.jpg",
    "/schwoaze-highway-3392100_1920.jpg",
    "/skica911-driver-3978839_1920.jpg",
    "/nairobi-city-shuttle-bus.jpg",
];

export default function BackgroundSlideshow({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    const [activeImage, setActiveImage] = useState(0);

    useEffect(() => {
        backgroundImages.forEach((source) => {
            const image = new Image();
            image.src = source;
        });

        const interval = window.setInterval(() => {
            setActiveImage((current) => (current + 1) % backgroundImages.length);
        }, 5000);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {backgroundImages.map((source, index) => (
                <div
                    key={source}
                    aria-hidden="true"
                    className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${activeImage === index ? "opacity-100" : "opacity-0"
                        }`}
                    style={{ backgroundImage: `url('${source}')` }}
                />
            ))}
            {children}
        </div>
    );
}
