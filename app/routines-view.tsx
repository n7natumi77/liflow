"use client";
import { Repeat2 } from "lucide-react";
import { SectionHeading, type SectionProps } from "./diary-section";
import { RecurringRulesSection } from "./recurring-rules";

/** RoutineFlow is retained in storage for compatibility, but retired from normal UI. */
export function RoutinesView(props: SectionProps) {
  return <section className="panel notebook routines-notebook">
    <SectionHeading icon={<Repeat2/>} title="繰り返し予定" description="授業や定期予定を、ひとつの予定として繰り返します。"/>
    <RecurringRulesSection {...props}/>
  </section>;
}
