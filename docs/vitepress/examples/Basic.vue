<script setup lang="ts">
import { ref } from "vue";
import AdditiveForceVisualizer from "../../../src/AdditiveForceVisualizer";
// import shap, { AdditiveForceVisualizer } from "@dangojs/vue3-shap";

console.log("AdditiveForceVisualizer", AdditiveForceVisualizer);
// console.log("shap", shap);

const features = ref({
  "0": { value: 1.0, effect: 1.0 },
  "1": { value: 0.0, effect: 0.5 },
  "2": { value: 2.0, effect: -2.5 },
  "3": { value: 2.0, effect: -0.05 },
  "4": { value: 1.0, effect: -0.5 },
});
const featureNames = ref({
  "0": "Blue",
  "1": "Red",
  "2": "Green",
  "3": "Orange",
  "4": "kuramakuramakuramakuramakuramakuramakuramakuramakuramakuramakuramakurama",
});

// setTimeout(() => {
//   features.value = {
//     "0": { value: 1.0, effect: 1.0 },
//     "1": { value: 0.0, effect: 0.5 },
//     "2": { value: 2.0, effect: -2.5 },
//     "3": { value: -0.05, effect: -0.05 },
//     "4": { value: -0.5, effect: -0.5 },
//   };
// }, 3000);
// setTimeout(() => {
//   featureNames.value = {
//     "0": "Blue",
//     "1": "Red",
//     "2": "Green",
//     "3": "Orange",
//     "4": "kuramakuramakuramakuramakuramakuramakuramakuramakuramakuramakuramakurama",
//   };
// }, 6000);
</script>

<template>
  <div>
    <AdditiveForceVisualizer
      :features="features"
      :featureNames="featureNames"
      plot_cmap="GnBu"
    />
  </div>
</template>
