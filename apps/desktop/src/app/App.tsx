import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useApplyTheme } from "@/lib/theme/useApplyTheme";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function App() {
  useApplyTheme();
  return (
    <TooltipProvider delayDuration={400}>
      <main className="flex h-full flex-col items-center justify-center gap-6 bg-surface text-ink">
        <h1 className="m-0 font-display text-display font-medium tracking-[-0.015em]">
          Lumora PDF
        </h1>
        <ThemeSwitcher />
      </main>
    </TooltipProvider>
  );
}
