import { motion } from "framer-motion";

export function ModScanOverlay() {
  return (
    <motion.div
      aria-label="mod-scan-loading"
      className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-slate-950/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <div className="grid justify-items-center gap-3 rounded-xl border border-accent/30 bg-white/90 px-6 py-5 shadow-sm dark:bg-slate-900/90">
        <motion.div
          className="h-7 w-7 rotate-45 rounded-sm border-2 border-accent bg-accent/20"
          animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Scanning mods...</p>
      </div>
    </motion.div>
  );
}
