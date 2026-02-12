import { motion } from "framer-motion";

interface AnimatedCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlip: () => void;
  className?: string;
}

export function AnimatedCard({ front, back, isFlipped, onFlip, className }: AnimatedCardProps) {
  return (
    <div className={`relative w-full h-96 cursor-pointer group perspective-1000 ${className}`} onClick={onFlip}>
      <motion.div
        className="w-full h-full relative transform-style-3d transition-transform duration-500"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Front Face */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-white border-2 border-primary/20 shadow-xl flex flex-col items-center justify-center p-8 text-center">
          <div className="absolute top-4 left-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Question</div>
          {front}
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary shadow-xl flex flex-col items-center justify-center p-8 text-center">
          <div className="absolute top-4 left-4 text-xs font-bold text-primary uppercase tracking-widest">Answer</div>
          {back}
        </div>
      </motion.div>
    </div>
  );
}
