import Image from "next/image";

const SRC = "/img/logo.png";
const ALT =
  "Auto Repuestos Multimarca — diesel, gasolina — repuestos originales";

type Props = {
  variant: "loginHero" | "loginMobile";
  className?: string;
  priority?: boolean;
};

/** Logo de marca: solo se usa en la página de inicio de sesión. */
export function SystemBrandLogo({ variant, className = "", priority = false }: Props) {
  if (variant === "loginHero") {
    return (
      <div className={`relative mx-auto h-28 w-full max-w-[320px] ${className}`}>
        <Image
          src={SRC}
          alt={ALT}
          fill
          sizes="(max-width: 1024px) 90vw, 320px"
          className="object-contain"
          priority={priority}
        />
      </div>
    );
  }
  return (
    <div className={`relative h-10 w-[140px] shrink-0 ${className}`}>
      <Image
        src={SRC}
        alt={ALT}
        fill
        sizes="140px"
        className="object-contain object-left"
        priority={priority}
      />
    </div>
  );
}
