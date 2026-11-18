import { BookOpen } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { INDOOR_GUIDE } from "@/lib/content/indoorGuide";

/** Expandable, general indoor-air guidance (static content). */
export function IndoorGuide() {
  return (
    <Card>
      <CardHeader
        icon={<BookOpen className="size-4" />}
        title="Indoor air guide"
        description="Practical, general guidance. Open a topic to read more."
      />
      <div className="divide-line divide-y">
        {INDOOR_GUIDE.map((section) => (
          <details key={section.id} className="group px-5 py-3">
            <summary className="text-ink flex min-h-10 cursor-pointer items-center justify-between font-semibold">
              {section.title}
              <span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="text-ink-2 mt-1 text-sm">{section.intro}</p>
            <ul className="text-ink-2 mt-2 list-disc space-y-1 pl-5 text-sm">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </Card>
  );
}
