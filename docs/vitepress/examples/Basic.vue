<script setup lang="ts">
import AdditiveForceVisualizer from "../../../src/AdditiveForceVisualizer";
const features = {
  "0": { value: 1.0, effect: 1.0 },
  "1": { value: 0.0, effect: 0.5 },
  "2": { value: 2.0, effect: -2.5 },
  "3": { value: 2.0, effect: -0.5 },
  "4": { value: 1.0, effect: -0.05 },
};
const featureNames = {
  "0": "Blue",
  "1": "Red",
  "2": "Green",
  "3": "Orange",
  "4": "saber",
};
</script>

<template>
  <div>
    这是一个demo
    <AdditiveForceVisualizer
      :features="features"
      :featureNames="featureNames"
    />
  </div>
</template>
