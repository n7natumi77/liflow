"use client";
import { Compass } from "lucide-react";
import type { CoreEntity, EntityType } from "../domain/core";
import { DirectionInsights } from "./direction-insights";
import { SectionHeading } from "./diary-section";

export function DirectionView({ entities, create, update }: {
  entities: CoreEntity[];
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
}) {
  return <section className="panel notebook direction-notebook">
    <SectionHeading icon={<Compass/>} title="方向" description="日々の細かなタスクから少し離れて、時間の向かう先を見渡します。"/>
    <DirectionInsights entities={entities} clock={new Date()} create={create} update={update}/>
  </section>;
}
