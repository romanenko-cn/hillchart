import { renderToStaticMarkup } from "react-dom/server";
import { HillChart } from "./ChartSvg";
import { sanitizeItems, sanitizeTitle } from "./hillchart";
import { isDotShape, type DotShape } from "./dotShape";

export type ChartInput = {
  title?: unknown;
  items?: unknown;
  dotShape?: unknown;
};

export function renderChartSvg(input: ChartInput): string {
  const title = sanitizeTitle(input.title);
  const items = sanitizeItems(input.items).filter((item) => item.name.trim().length > 0);
  const dotShape: DotShape = isDotShape(input.dotShape) ? input.dotShape : "dot";

  return renderToStaticMarkup(
    <HillChart title={title} items={items} dotShape={dotShape} />,
  );
}
