import { computed, defineComponent, onMounted, PropType, ref } from "vue";
import { sortBy, map, each, sum, filter, findIndex, debounce } from "lodash";
import { select } from "d3-selection";
import { format } from "d3-format";
import { scaleLinear } from "d3-scale";
import { axisBottom } from "d3-axis";
import { line } from "d3-shape";
import { hsl } from "d3-color";
import colorsSet from "./color-set";

// SHAP.React.createElement(SHAP.AdditiveForceVisualizer, {
//   baseValue: 0.0,
//   link: "identity",
//   featureNames: {
//     "0": "Blue",
//     "1": "Red",
//     "2": "Green",
//     "3": "Orange"
//   },
//   outNames: ["color rating"],
//   features: {
//     "0": { value: 1.0, effect: 1.0 },
//     "1": { value: 0.0, effect: 0.5 },
//     "2": { value: 2.0, effect: -2.5 },
//     "3": { value: 2.0, effect: -0.5 }
//   }
// }),

export default defineComponent({
  name: "AdditiveForceVisualizer",
  props: {
    /**
     * @zh 特征名称
     */
    featureNames: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
    features: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    baseValue: {
      type: Number as PropType<number>,
      default: 0.0,
    },
    link: {
      type: String as PropType<"identity" | "logit">,
      default: "identity",
    },
    plot_cmap: {
      type: [String, Array] as PropType<string | any[]>,
      default: "RdBu",
    },
  },
  setup(props) {
    const svgRef = ref();
    const chart = ref();
    let mainGroup: any, axisElement: any, axis: any, scaleCentered: any;
    const tickFormat = format(",.4");
    //
    const invLinkFunction = computed(() => {
      let _fn = (x: number) => props.baseValue + x;
      if (props.link === "identity") {
        _fn = (x) => props.baseValue + x;
      }
      if (props.link === "logit") {
        _fn = (x: number) => 1 / (1 + Math.exp(-(props.baseValue + x))); // logistic is inverse of logit
      }
      return _fn;
    });

    // colors

    const colors = computed(() => {
      let plot_colors = undefined;
      if (typeof props.plot_cmap === "string") {
        if (!(props.plot_cmap in colorsSet.colors)) {
          console.log("Invalid color map name, reverting to default.");
          plot_colors = colorsSet.colors.RdBu;
        } else {
          plot_colors = colorsSet.colors[props.plot_cmap as any];
        }
      } else if (Array.isArray(props.plot_cmap)) {
        plot_colors = props.plot_cmap;
      }
      return plot_colors.map((x: any) => hsl(x));
    });

    onMounted(() => {
      if (svgRef.value) {
        chart.value = select(svgRef.value);
        mainGroup = chart.value.append("g");
        // axisElement
        axisElement = mainGroup
          .append("g")
          .attr("transform", "translate(0,35)")
          .attr("class", "force-bar-axis");
        scaleCentered = scaleLinear();
        axis = axisBottom(scaleCentered)
          .tickSizeInner(4)
          .tickSizeOuter(0)
          .tickFormat((d) => tickFormat(invLinkFunction.value?.(d as number)))
          .tickPadding(-18);
        draw();
        // // 开始绘制一个矩形实时
        // const barData = [45, 67, 96, 84, 41];
        // const rectWidth = 50;
        // chart.value
        //   .selectAll("rect")
        //   .data(barData)
        //   .attr("x", (d, i) => i * rectWidth)
        //   // set height based on the bound datum
        //   .attr("height", (d) => d)
        //   // rest of attributes are constant values
        //   .attr("width", rectWidth)
        //   .attr("stroke-width", 3)
        //   .attr("stroke", "plum")
        //   .attr("fill", "pink")
        //   .enter()
        //   .append("rect")
        //   // calculate x-position based on its index
        //   .attr("x", (d, i) => i * rectWidth)
        //   // set height based on the bound datum
        //   .attr("height", (d) => d)
        //   // rest of attributes are constant values
        //   .attr("width", rectWidth)
        //   .attr("stroke-width", 3)
        //   .attr("stroke", "plum")
        //   .attr("fill", "pink");
      }
    });
    const draw = () => {
      // each(props.featureNames, (n, i) => {
      //   if (props.features[i]) this.props.features[i].name = n;
      // });

      let width = chart.value.node().parentNode.offsetWidth;
      console.log("width", width);
      // 延迟绘制
      if (width == 0) return setTimeout(() => draw(), 500);
      chart.value.style("height", 150 + "px");
      chart.value.style("width", width + "px");
      let topOffset = 50;
      let data = sortBy(props.features, (x) => -1 / (x.effect + 1e-10));
      let totalEffect = sum(map(data, (x) => Math.abs(x.effect)));
      let totalPosEffects =
        sum(
          map(
            filter(data, (x) => x.effect > 0),
            (x) => x.effect
          )
        ) || 0;
      let totalNegEffects =
        sum(
          map(
            filter(data, (x) => x.effect < 0),
            (x) => -x.effect
          )
        ) || 0;
      console.log("data", data, totalEffect, totalPosEffects, totalNegEffects);
      const domainSize = Math.max(totalPosEffects, totalNegEffects) * 3;
      let scale = scaleLinear().domain([0, domainSize]).range([0, width]);
      let scaleOffset = width / 2 - scale(totalNegEffects);
      console.log("scaleOffset", scaleOffset, domainSize);
      scaleCentered
        .domain([-domainSize / 2, domainSize / 2])
        .range([0, width])
        .clamp(true);
      // 绘制 axis
      axisElement
        .attr("transform", "translate(0," + topOffset + ")")
        .call(axis);

      let pos = 0,
        i,
        joinPoint,
        joinPointIndex: any;
      for (i = 0; i < data.length; ++i) {
        data[i].x = pos;
        if (data[i].effect < 0 && joinPoint === undefined) {
          joinPoint = pos;
          joinPointIndex = i;
        }
        pos += Math.abs(data[i].effect);
      }
      if (joinPoint === undefined) {
        joinPoint = pos;
        joinPointIndex = i;
      }
      let lineFunction = line()
        .x((d) => d[0])
        .y((d) => d[1]);
      let blocks = mainGroup.selectAll(".force-bar-blocks").data(data);
      blocks
        .enter()
        .append("path")
        .attr("class", "force-bar-blocks")
        .merge(blocks)
        .attr("d", (d: any, i: number) => {
          console.log("d", d);
          let x = scale(d.x) + scaleOffset;
          let w = scale(Math.abs(d.effect));
          console.log("d", x, w);
          // todo: 为啥是4
          let pointShiftStart = d.effect < 0 ? -4 : 4;
          let pointShiftEnd = pointShiftStart;
          if (i === joinPointIndex) pointShiftStart = 0;
          if (i === joinPointIndex - 1) pointShiftEnd = 0;
          return lineFunction([
            [x, 6 + topOffset],
            [x + w, 6 + topOffset],
            [x + w + pointShiftEnd, 14.5 + topOffset],
            [x + w, 23 + topOffset],
            [x, 23 + topOffset],
            [x + pointShiftStart, 14.5 + topOffset],
          ]);
        })
        .attr("fill", (d: any) =>
          d.effect > 0 ? colors.value[0] : colors.value[1]
        );
    };
    return () => {
      return <svg ref={svgRef}></svg>;
    };
  },
});
