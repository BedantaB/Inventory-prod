import { ComingSoon } from "@/components/coming-soon";
import { getMessages } from "@/i18n";

// Built in a later phase (see docs/PLAN.md).
export default function Page() {
  return <ComingSoon title={getMessages().nav.addStock} />;
}
