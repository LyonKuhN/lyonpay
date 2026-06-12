import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "../../contexts/ThemeContext"
import type { LucideIcon } from "lucide-react"

interface MenuItem {
  icon: LucideIcon | React.FC<any>
  label: string
  href: string
  gradient: string
  iconColor: string
}

interface MenuBarProps extends Omit<React.HTMLAttributes<HTMLElement>, "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"> {
  items: MenuItem[]
  activeItem?: string
  onItemClick?: (label: string, href: string) => void
}

const itemVariants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
}

const backVariants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
}

const glowVariants: any = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
    },
  },
}

const navGlowVariants: any = {
  initial: { opacity: 0 },
  hover: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
}

const sharedTransition: any = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  duration: 0.5,
}

export const MenuBar = React.forwardRef<HTMLElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick, ...props }, ref) => {
    const { theme } = useTheme()
    const isDarkTheme = theme === "dark"

    return (
      <motion.nav
        ref={ref}
        className={`p-2 rounded-full bg-[#15151A]/90 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden ${className || ""}`}
        initial="initial"
        whileHover="hover"
        {...props}
      >
        <motion.div
          className={`absolute -inset-2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent ${
            isDarkTheme
              ? "via-blue-400/20 via-30% via-purple-400/20 via-60% via-[#a3ff12]/20 via-90%"
              : "via-blue-400/10 via-30% via-purple-400/10 via-60% via-[#a3ff12]/10 via-90%"
          } to-transparent rounded-3xl z-0 pointer-events-none`}
          variants={navGlowVariants}
        />
        <ul className="flex items-center gap-1 md:gap-2 relative z-10 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = item.label === activeItem

            return (
              <motion.li key={item.label} className="relative shrink-0">
                <button
                  onClick={() => onItemClick?.(item.label, item.href)}
                  className="block w-full"
                >
                  <motion.div
                    className="block rounded-xl overflow-visible group relative"
                    style={{ perspective: "600px" }}
                    whileHover="hover"
                    initial="initial"
                  >
                    <motion.div
                      className="absolute inset-0 z-0 pointer-events-none"
                      variants={glowVariants}
                      animate={isActive ? "hover" : "initial"}
                      style={{
                        background: item.gradient,
                        opacity: isActive ? 1 : 0,
                        borderRadius: "16px",
                      }}
                    />
                    <motion.div
                      className={`flex items-center gap-2 px-3 md:px-4 py-2 relative z-10 bg-transparent transition-colors rounded-xl ${
                        isActive
                          ? "text-white"
                          : "text-zinc-500 group-hover:text-white"
                      }`}
                      variants={itemVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center bottom",
                      }}
                    >
                      <span
                        className={`transition-colors duration-300 ${
                          isActive ? item.iconColor : "text-white"
                        } group-hover:${item.iconColor}`}
                      >
                        <Icon className="h-4 w-4 md:h-5 md:w-5" />
                      </span>
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{item.label}</span>
                    </motion.div>
                    <motion.div
                      className={`flex items-center gap-2 px-3 md:px-4 py-2 absolute inset-0 z-10 bg-transparent transition-colors rounded-xl ${
                        isActive
                          ? "text-white"
                          : "text-zinc-500 group-hover:text-white"
                      }`}
                      variants={backVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center top",
                        rotateX: 90,
                      }}
                    >
                      <span
                        className={`transition-colors duration-300 ${
                          isActive ? item.iconColor : "text-white"
                        } group-hover:${item.iconColor}`}
                      >
                        <Icon className="h-4 w-4 md:h-5 md:w-5" />
                      </span>
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{item.label}</span>
                    </motion.div>
                  </motion.div>
                </button>
              </motion.li>
            )
          })}
        </ul>
      </motion.nav>
    )
  },
)

MenuBar.displayName = "MenuBar"
