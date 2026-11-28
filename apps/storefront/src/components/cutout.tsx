import Image from "next/image";

/** A transparent product cut-out placed inside a relative container (percent geometry). */
export function Cutout({ src, alt = "", box, sizes = "200px", priority }: { src: string; alt?: string; box: [number, number, number, number]; sizes?: string; priority?: boolean }) {
  const [left, top, width, height] = box;
  return (
    <span className="absolute" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-contain drop-shadow-[0_14px_18px_rgba(14,42,46,0.22)]" />
    </span>
  );
}

