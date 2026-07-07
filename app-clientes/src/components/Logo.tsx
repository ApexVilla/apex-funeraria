import { motion } from "framer-motion";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <motion.div
      initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 16 }}
      className="flex items-center gap-2"
    >
      <img
        src="/logo.png"
        alt="Fênix Logo"
        style={{ width: size, height: size }}
        className="rounded-2xl object-cover shadow-glow"
      />
    </motion.div>
  );
}

