"use client";

import { useEffect, useState } from "react";

type CharityImageProps = {
  src: string | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  loading?: "eager" | "lazy";
};

export default function CharityImage({
  src,
  alt,
  className = "",
  fallbackSrc = "/charity.jpg",
  loading = "lazy",
}: CharityImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setResolvedSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      onError={() => {
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
      className={className}
    />
  );
}
