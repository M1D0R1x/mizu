"use client";
import { FarMountains, Terrain } from "@/components/world/Terrain";
import { Lake } from "@/components/world/Water";
import { Rocks, Trees } from "@/components/world/Vegetation";
import { Grass } from "@/components/world/Grass";
import { BambooForest } from "@/components/world/Bamboo";
import { Village } from "@/components/world/Village";
import { Shrine } from "@/components/world/Shrine";
import { LakeSide } from "@/components/world/LakeSide";
import { Station, Train } from "@/components/world/Station";
import { RiceTerraces } from "@/components/world/RiceTerraces";
import { Stream } from "@/components/world/Stream";
import { Mist } from "@/components/world/Mist";
import { Particles } from "@/components/world/Particles";
import { Animals } from "@/components/animals/Animals";
import { Ruins } from "@/components/world/Ruins";

export function World() {
  return (
    <>
      <Terrain />
      <FarMountains />
      <Lake />
      <Stream />
      <RiceTerraces />
      <Grass />
      <Trees />
      <Rocks />
      <BambooForest />
      <Village />
      <Shrine />
      <Ruins />
      <LakeSide />
      <Station />
      <Train />
      <Mist />
      <Particles />
      <Animals />
    </>
  );
}
