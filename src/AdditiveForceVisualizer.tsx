import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  onUpdated,
  PropType,
  ref,
} from "vue";
import { sortBy, map, each, sum, filter, debounce } from "lodash";
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
      default: "GnPR",
    },
    labelMargin: {
      type: Number as PropType<number>,
      default: 20,
    },
    baseValueTitle: {
      type: String as PropType<string>,
      default: "基准值",
    },
    outNames: {
      type: Array as PropType<string[]>,
      default: ["对预测得分贡献"],
    },
  },
  setup(props) {
    const svgRef = ref();
    const chart = ref();
    let mainGroup: any,
      axisElement: any,
      onTopGroup: any,
      axis: any,
      scaleCentered: any,
      brighterColors: any,
      baseValueTitle: any,
      joinPointLine: any,
      joinPointLabelOutline: any,
      joinPointLabel: any,
      joinPointTitle: any,
      joinPointTitleLeft: any,
      joinPointTitleLeftArrow: any,
      joinPointTitleRightArrow: any,
      joinPointTitleRight: any;
    let hoverLabelBacking: any, hoverLabel: any;
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

    const featuresData = computed(() => {
      let _featuresData = { ...props.features };
      each(props.featureNames, (n, i) => {
        if (_featuresData[i]) _featuresData[i].name = n;
      });
      return _featuresData;
    });

    const getLabel = (d: any) => {
      if (d.value !== undefined && d.value !== null && d.value !== "") {
        return (
          d.name + " = " + (isNaN(d.value) ? d.value : tickFormat(d.value))
        );
      } else return d.name;
    };
    onMounted(() => {
      if (svgRef.value) {
        chart.value = select(svgRef.value);
        mainGroup = chart.value.append("g");
        // axisElement
        axisElement = mainGroup
          .append("g")
          .attr("transform", "translate(0,35)")
          .attr("class", "force-bar-axis");
        onTopGroup = chart.value.append("g");
        baseValueTitle = chart.value.append("text");
        joinPointLine = chart.value.append("line");
        joinPointLabelOutline = chart.value.append("text");
        joinPointLabel = chart.value.append("text");
        joinPointTitle = chart.value.append("text");
        joinPointTitleLeft = chart.value.append("text");
        joinPointTitleLeftArrow = chart.value.append("text");
        joinPointTitleRightArrow = chart.value.append("text");
        joinPointTitleRight = chart.value.append("text");

        hoverLabelBacking = chart.value
          .append("text")
          .attr("x", 10)
          .attr("y", 20)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("stroke", "#fff")
          .attr("fill", "#fff")
          .attr("stroke-width", "4")
          .attr("stroke-linejoin", "round")
          .text("")
          .on("mouseover", () => {
            hoverLabel.attr("opacity", 1);
            hoverLabelBacking.attr("opacity", 1);
          })
          .on("mouseout", () => {
            hoverLabel.attr("opacity", 0);
            hoverLabelBacking.attr("opacity", 0);
          });
        hoverLabel = chart.value
          .append("text")
          .attr("x", 10)
          .attr("y", 20)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("fill", "#0f0")
          .text("")
          .on("mouseover", () => {
            hoverLabel.attr("opacity", 1);
            hoverLabelBacking.attr("opacity", 1);
          })
          .on("mouseout", () => {
            hoverLabel.attr("opacity", 0);
            hoverLabelBacking.attr("opacity", 0);
          });

        scaleCentered = scaleLinear();
        axis = axisBottom(scaleCentered)
          .tickSizeInner(4)
          .tickSizeOuter(0)
          .tickFormat((d) => tickFormat(invLinkFunction.value?.(d as number)))
          .tickPadding(-18);

        brighterColors = [1.45, 1.6].map((v, i) => colors.value[i].brighter(v));
        colors.value.map((c: any, i: any) => {
          let grad = chart.value
            .append("linearGradient")
            .attr("id", "linear-grad-" + i)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
          grad
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", c)
            .attr("stop-opacity", 0.6);
          grad
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", c)
            .attr("stop-opacity", 0);
          let grad2 = chart.value
            .append("linearGradient")
            .attr("id", "linear-backgrad-" + i)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
          grad2
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", c)
            .attr("stop-opacity", 0.5);
          grad2
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", c)
            .attr("stop-opacity", 0);
        });
        window.addEventListener("resize", redraw);
        setTimeout(redraw, 50);
      }
    });
    onUpdated(() => {
      redraw();
    });
    onUnmounted(() => {
      window.removeEventListener("resize", redraw);
    });
    const draw = () => {
      let width = chart.value.node().parentNode?.offsetWidth || 0;
      // 延迟绘制
      if (width == 0) return setTimeout(() => draw(), 500);
      chart.value.style("height", 200 + "px");
      chart.value.style("width", width + "px");
      let topOffset = 70;
      // 增加空隙间距
      const topSpace = 8;
      // 增加文字和柱状图的间距
      const labelBackingSpace = 28;
      let data = sortBy(featuresData.value, (x) => -1 / (x.effect + 1e-10));
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
      const domainSize = Math.max(totalPosEffects, totalNegEffects) * 3;
      let scale = scaleLinear().domain([0, domainSize]).range([0, width]);
      let scaleOffset = width / 2 - scale(totalNegEffects);
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
          let x = scale(d.x) + scaleOffset;
          let w = scale(Math.abs(d.effect));
          // todo: 为啥是4
          let pointShiftStart = d.effect < 0 ? -4 : 4;
          let pointShiftEnd = pointShiftStart;
          if (i === joinPointIndex) pointShiftStart = 0;
          if (i === joinPointIndex - 1) pointShiftEnd = 0;
          return lineFunction([
            [x, 6 + topSpace + topOffset],
            [x + w, 6 + topSpace + topOffset],
            [x + w + pointShiftEnd, 14.5 + topSpace + topOffset],
            [x + w, 23 + topSpace + topOffset],
            [x, 23 + topSpace + topOffset],
            [x + pointShiftStart, 14.5 + topSpace + topOffset],
          ]);
        })
        .attr("fill", (d: any) =>
          d.effect > 0 ? colors.value[0] : colors.value[1]
        )
        .on("mouseover", (event: any, d: any) => {
          if (
            scale(Math.abs(d.effect)) < scale(totalEffect) / 50 ||
            scale(Math.abs(d.effect)) < 10
          ) {
            let x = scale(d.x) + scaleOffset;
            let w = scale(Math.abs(d.effect));
            hoverLabel
              .attr("opacity", 1)
              .attr("x", x + w / 2)
              .attr("y", topOffset + 0.5)
              .attr("fill", d.effect > 0 ? colors.value[0] : colors.value[1])
              .text(getLabel(d));
            hoverLabelBacking
              .attr("opacity", 1)
              .attr("x", x + w / 2)
              .attr("y", topOffset + 0.5)
              .text(getLabel(d));
          }
        })
        .on("mouseout", () => {
          hoverLabel.attr("opacity", 0);
          hoverLabelBacking.attr("opacity", 0);
        });
      blocks.exit().remove();

      // 绘制标签？
      let filteredData = filter(data, (d) => {
        return (
          scale(Math.abs(d.effect)) > scale(totalEffect) / 50 &&
          scale(Math.abs(d.effect)) > 10
        );
      });
      let labels = onTopGroup.selectAll(".force-bar-labels").data(filteredData);
      labels.exit().remove();
      labels = labels
        .enter()
        .append("text")
        .attr("class", "force-bar-labels")
        .attr("font-size", "12px")
        .attr("y", 48 + topOffset + topSpace + 8 + labelBackingSpace)
        .merge(labels)
        .text((d: any) => {
          return "";
          // if (d.value !== undefined && d.value !== null && d.value !== "") {
          //   return (
          //     d.name + " = " + (isNaN(d.value) ? d.value : tickFormat(d.value))
          //   );
          // } else return d.name;
        })
        .attr("fill", (d: any) =>
          d.effect > 0 ? colors.value[0] : colors.value[1]
        )
        .attr("stroke", function (d: any) {
          d.textWidth = Math.max(
            // @ts-ignore
            this.getComputedTextLength(),
            scale(Math.abs(d.effect)) - 10
          );
          // @ts-ignore
          d.innerTextWidth = this.getComputedTextLength();
          return "none";
        });

      labels
        .selectAll(".force-bar-labels")
        .data((d: any) => {
          return [d, d];
        })
        .enter()
        // .merge(labels)
        .append("tspan")
        .text((d: any, index: number) => {
          if (index === 0) {
            return d.name + ": ";
          }
          if (d.value !== undefined && d.value !== null && d.value !== "") {
            return isNaN(d.value) ? d.value : tickFormat(d.value);
          } else return "";
        })
        .attr("fill", (d: any, index: number) => {
          if (index === 0) {
            return "#60646F";
          }
          return d.effect > 0 ? colors.value[0] : colors.value[1];
        })
        .attr("font-weight", (_: any, index: number) => {
          if (index === 1) {
            return "bold";
          }
        });
      labels
        .enter()
        .merge(labels)
        .attr("stroke", function (d: any) {
          d.textWidth = Math.max(
            // @ts-ignore
            this.getComputedTextLength(),
            scale(Math.abs(d.effect)) - 10
          );
          // @ts-ignore
          d.innerTextWidth = this.getComputedTextLength();
          return "none";
        });

      let labels1 = onTopGroup
        .selectAll(".force-bar-labels1")
        .data(filteredData);
      labels1.exit().remove();
      labels1 = labels1
        .enter()
        .append("text")
        .attr("class", "force-bar-labels1")
        .attr("font-size", "12px")
        .attr("y", 64 + topOffset + topSpace + 8 + labelBackingSpace)
        .merge(labels1)
        .text((d: any) => {
          return "";
          // if (d.value !== undefined && d.value !== null && d.value !== "") {
          //   return (
          //     d.name + " = " + (isNaN(d.value) ? d.value : tickFormat(d.value))
          //   );
          // } else return d.name;
        });

      labels1
        .selectAll(".force-bar-labels1")
        .data((d: any) => {
          return [d, d];
        })
        .enter()
        // .merge(labels)
        .append("tspan")
        .text((d: any, index: number) => {
          if (index === 0) {
            return "贡献值: ";
          }
          return d.effect;
        })
        .attr("fill", (d: any, index: number) => {
          if (index === 0) {
            return "#60646F";
          }
          return d.effect > 0 ? colors.value[0] : colors.value[1];
        })
        .attr("font-weight", (_: any, index: number) => {
          if (index === 1) {
            return "bold";
          }
        });
      labels1
        .enter()
        .merge(labels1)
        .attr("stroke", function (d: any) {
          const textWidth = d.textWidth || 0;
          d.textWidth = Math.max(
            textWidth,
            // @ts-ignore
            this.getComputedTextLength(),
            scale(Math.abs(d.effect)) - 10
          );
          const innerTextWidth = d.innerTextWidth || 0;
          d.innerTextWidth = Math.max(
            innerTextWidth,
            // @ts-ignore
            this.getComputedTextLength()
          );
          return "none";
        });

      // compute where the text labels should go
      if (data.length > 0) {
        pos = joinPoint + scale.invert(5);
        for (let i = joinPointIndex; i < data.length; ++i) {
          data[i].textx = pos;
          pos += scale.invert(data[i].textWidth + 10);
        }
        pos = joinPoint - scale.invert(5);
        for (let i = joinPointIndex - 1; i >= 0; --i) {
          data[i].textx = pos;
          pos -= scale.invert(data[i].textWidth + 10);
        }
      }

      labels
        .attr("x", (d: any) => {
          return (
            scale(d.textx) +
            scaleOffset +
            (d.effect > 0 ? -d.textWidth / 2 : d.textWidth / 2) -
            d.innerTextWidth / 2
          );
        })
        .attr("text-anchor", "start"); //d => d.effect > 0 ? 'end' : 'start');
      labels1
        .attr(
          "x",
          (d: any) =>
            scale(d.textx) +
            scaleOffset +
            (d.effect > 0 ? -d.textWidth / 2 : d.textWidth / 2) -
            d.innerTextWidth / 2
        )
        .attr("text-anchor", "start"); //d => d.effect > 0 ? 'end' : 'start');

      const a = filter(filteredData, (d) => {
        return (
          scale(d.textx) + scaleOffset > props.labelMargin &&
          scale(d.textx) + scaleOffset < width - props.labelMargin
        );
      });

      let labelBacking = mainGroup.selectAll(".force-bar-labelBacking").data(a);
      labelBacking
        .enter()
        .append("path")
        .attr("class", "force-bar-labelBacking")
        .attr("stroke", "none")
        .attr("opacity", 0.2)
        .merge(labelBacking)
        .attr("d", (d: any) => {
          return lineFunction([
            [
              scale(d.x) + scale(Math.abs(d.effect)) + scaleOffset,
              23 + topOffset + topSpace,
            ],
            [
              (d.effect > 0 ? scale(d.textx) : scale(d.textx) + d.textWidth) +
                scaleOffset +
                5,
              35 + topOffset + topSpace + labelBackingSpace,
            ],
            [
              (d.effect > 0 ? scale(d.textx) : scale(d.textx) + d.textWidth) +
                scaleOffset +
                5,
              54 + 30 + topOffset + topSpace + labelBackingSpace,
            ],
            [
              (d.effect > 0 ? scale(d.textx) - d.textWidth : scale(d.textx)) +
                scaleOffset -
                5,
              54 + 30 + topOffset + topSpace + labelBackingSpace,
            ],
            [
              (d.effect > 0 ? scale(d.textx) - d.textWidth : scale(d.textx)) +
                scaleOffset -
                5,
              35 + topOffset + topSpace + labelBackingSpace,
            ],
            [scale(d.x) + scaleOffset, 23 + topOffset + topSpace],
          ]);
        })
        .attr(
          "fill",
          (d: any) => `url(#linear-backgrad-${d.effect > 0 ? 0 : 1})`
        );
      labelBacking.exit().remove();

      let labelDividers = mainGroup
        .selectAll(".force-bar-labelDividers")
        .data(a.slice(0, -1));
      labelDividers
        .enter()
        .append("rect")
        .attr("class", "force-bar-labelDividers")
        .attr("height", "36px")
        .attr("width", "1px")
        .attr("y", 35 + topOffset + topSpace + 8 + labelBackingSpace)
        .merge(labelDividers)
        .attr(
          "x",
          (d: any) =>
            (d.effect > 0 ? scale(d.textx) : scale(d.textx) + d.textWidth) +
            scaleOffset +
            4.5
        )
        .attr("fill", (d: any) => `url(#linear-grad-${d.effect > 0 ? 0 : 1})`);
      labelDividers.exit().remove();

      let blockDividers = mainGroup
        .selectAll(".force-bar-blockDividers")
        .data(data.slice(0, -1));
      blockDividers
        .enter()
        .append("path")
        .attr("class", "force-bar-blockDividers")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .merge(blockDividers)
        .attr("d", (d: any) => {
          let pos = scale(d.x) + scale(Math.abs(d.effect)) + scaleOffset;
          return lineFunction([
            [pos, 6 + topOffset + topSpace],
            [pos + (d.effect < 0 ? -4 : 4), 14.5 + topOffset + topSpace],
            [pos, 23 + topOffset + topSpace],
          ]);
        })
        .attr("stroke", (d: any, i: any) => {
          if (joinPointIndex === i + 1 || Math.abs(d.effect) < 1e-8)
            return "#rgba(0,0,0,0)";
          else if (d.effect > 0) return brighterColors[0];
          else return brighterColors[1];
        });
      blockDividers.exit().remove();

      joinPointLine
        .attr("x1", scale(joinPoint) + scaleOffset)
        .attr("x2", scale(joinPoint) + scaleOffset)
        .attr("y1", 0 + topOffset)
        .attr("y2", 6 + topOffset)
        .attr("stroke", "#F2F2F2")
        .attr("stroke-width", 1)
        .attr("opacity", 1);

      joinPointLabelOutline
        .attr("x", scale(joinPoint) + scaleOffset)
        .attr("y", -5 + topOffset)
        .attr("color", "#fff")
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("stroke", "#fff")
        .attr("stroke-width", 6)
        .text(
          format(",.2f")(invLinkFunction.value(joinPoint - totalNegEffects))
        )
        .attr("opacity", 1);

      joinPointLabel
        .attr("x", scale(joinPoint) + scaleOffset)
        .attr("y", -5 + topOffset)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("fill", "#000")
        .text(
          format(",.2f")(invLinkFunction.value(joinPoint - totalNegEffects))
        )
        .attr("opacity", 1);

      joinPointTitle
        .attr("x", scale(joinPoint) + scaleOffset)
        .attr("y", -28 + topOffset)
        .attr("text-anchor", "middle")
        .attr("font-size", "12")
        .attr("fill", "#000")
        .text(props.outNames[0])
        .attr("opacity", 0.5);

      joinPointTitleLeft
        .attr("x", scale(joinPoint) + scaleOffset - 16)
        .attr("y", -38 + topOffset - 16)
        .attr("text-anchor", "end")
        .attr("font-size", "13")
        .attr("fill", colors.value[0])
        .text("higher")
        .attr("opacity", 1.0);
      joinPointTitleRight
        .attr("x", scale(joinPoint) + scaleOffset + 16)
        .attr("y", -38 + topOffset - 16)
        .attr("text-anchor", "start")
        .attr("font-size", "13")
        .attr("fill", colors.value[1])
        .text("lower")
        .attr("opacity", 1.0);

      joinPointTitleLeftArrow
        .attr("x", scale(joinPoint) + scaleOffset + 7)
        .attr("y", -42 + topOffset - 16)
        .attr("text-anchor", "end")
        .attr("font-size", "13")
        .attr("fill", colors.value[0])
        .text("→")
        .attr("opacity", 1.0);
      joinPointTitleRightArrow
        .attr("x", scale(joinPoint) + scaleOffset - 7)
        .attr("y", -36 + topOffset - 16)
        .attr("text-anchor", "start")
        .attr("font-size", "13")
        .attr("fill", colors.value[1])
        .text("←")
        .attr("opacity", 1.0);

      baseValueTitle
        .attr("x", scaleCentered(0))
        .attr("y", -28 + topOffset)
        .attr("text-anchor", "middle")
        .attr("font-size", "12")
        .attr("fill", "#000")
        .text(props.baseValueTitle)
        .attr("opacity", 0.5);

      const onTopGroupBBox = onTopGroup.node().getBBox();
      const joinPointTitleBBox = joinPointTitle.node().getBBox();
      const baseValueTitleBBox = baseValueTitle.node().getBBox();
      if (
        !(
          baseValueTitleBBox.x >
            joinPointTitleBBox.x + joinPointTitleBBox.width ||
          baseValueTitleBBox.x + baseValueTitleBBox.width < joinPointTitleBBox.x
        )
      ) {
        baseValueTitle.attr("opacity", 0);
      }
      let onTopGroupW = width;
      if (onTopGroupBBox.x < 0) {
        const w1 = Math.abs(onTopGroupBBox.x) + onTopGroupBBox.width;
        const w2 = Math.abs(onTopGroupBBox.x) + width;
        onTopGroupW = w1 > w2 ? w1 : w2;
      } else {
        onTopGroupW = Math.abs(onTopGroupBBox.x) + onTopGroupBBox.width;
      }

      if (onTopGroupW > width + 1) {
        chart.value.style("width", onTopGroupW + "px");
        if (onTopGroupBBox.x < 0) {
          chart.value.attr(
            "viewBox",
            `${onTopGroupBBox.x} 0 ${onTopGroupW} ${200}`
          );
        } else {
          chart.value.attr("viewBox", null);
        }
      } else {
        chart.value.attr("viewBox", null);
      }
    };
    const redraw = debounce(() => draw(), 200);
    return () => {
      return <svg ref={svgRef}></svg>;
    };
  },
});
