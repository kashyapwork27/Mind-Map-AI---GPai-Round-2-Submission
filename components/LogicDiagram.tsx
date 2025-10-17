import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { LogicDiagramData, LogicDiagramNode, LogicDiagramLink } from '../types';

interface LogicDiagramProps {
  data: LogicDiagramData;
}

const LogicDiagram: React.FC<LogicDiagramProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !data.nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('background-color', 'transparent');

    svg.selectAll('*').remove();
    
    const g = svg.append('g');

    const nodeWidth = 160;
    const nodeHeight = 80;
    
    // 1. Calculate layout using Dagre
    const { layoutedNodes, layoutedLinks, graphWidth, graphHeight } = getLayoutedElements(data, nodeWidth, nodeHeight);
    
    // 2. Render elements
    // Arrowhead marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 9)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#9ca3af')
      .style('stroke', 'none');

    // Links
    const lineGenerator = d3.line<{ x: number, y: number }>()
        .x(p => p.x)
        .y(p => p.y)
        .curve(d3.curveBasis);

    g.append('g')
        .attr('fill', 'none')
        .attr('stroke', '#9ca3af')
        .attr('stroke-opacity', 0.8)
        .attr('stroke-width', 2)
      .selectAll('path')
      .data(layoutedLinks)
      .join('path')
        .attr('d', d => lineGenerator(d.points))
        .attr('marker-end', 'url(#arrowhead)');

    // Link Labels
    g.append('g')
      .selectAll('.link-label')
      .data(layoutedLinks.filter(l => l.label))
      .enter().append('text')
      .attr('class', 'link-label')
      .attr('font-size', '12px')
      .attr('fill', '#d1d5db')
      .attr('text-anchor', 'middle')
      .attr('x', d => {
          const midPointIndex = Math.floor(d.points.length / 2);
          return d.points[midPointIndex].x;
      })
      .attr('y', d => {
          const midPointIndex = Math.floor(d.points.length / 2);
          return d.points[midPointIndex].y - 5;
      })
      .text(d => d.label || '');


    // Nodes
    const node = g.append('g')
      .selectAll('.node')
      .data(layoutedNodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Node shapes
    node.each(function(d) {
        const group = d3.select(this);
        const halfWidth = nodeWidth / 2;
        const halfHeight = nodeHeight / 2;

        switch (d.shape) {
            case 'diamond':
                group.append('path')
                    .attr('d', `M 0 ${-halfHeight} L ${halfWidth} 0 L 0 ${halfHeight} L ${-halfWidth} 0 Z`);
                break;
            case 'ellipse':
                group.append('ellipse')
                    .attr('rx', halfWidth)
                    .attr('ry', halfHeight);
                break;
            default: // rect
                group.append('rect')
                    .attr('x', -halfWidth)
                    .attr('y', -halfHeight)
                    .attr('width', nodeWidth)
                    .attr('height', nodeHeight)
                    .attr('rx', 5);
                break;
        }
    });

    node.selectAll('path, rect, ellipse')
        .attr('fill', '#334155')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 3);

    // Node Labels with text wrapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .style('font-size', '14px')
      .text(d => d.label)
      .call(wrapText, nodeWidth - 20);

    // 3. Zoom and Pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    // Center the graph
    const padding = 40;
    const scale = Math.min(
        (width - padding * 2) / graphWidth,
        (height - padding * 2) / graphHeight,
        1
    );
    const translateX = (width - graphWidth * scale) / 2;
    const translateY = (height - graphHeight * scale) / 2;
    
    svg.call(zoom)
        .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));

  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef}></svg>
    </div>
  );
};

// --- UTILITY FUNCTIONS ---

function getLayoutedElements(data: LogicDiagramData, nodeWidth: number, nodeHeight: number) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    data.nodes.forEach(node => {
        g.setNode(node.id, { label: node.label, width: nodeWidth, height: nodeHeight });
    });

    data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        g.setEdge(sourceId, targetId, { label: link.label });
    });

    dagre.layout(g);

    const layoutedNodes = data.nodes.map(node => {
        const nodeWithPosition = g.node(node.id);
        return { ...node, x: nodeWithPosition.x, y: nodeWithPosition.y };
    });

    const layoutedLinks = data.links.map(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const edge = g.edge({ v: sourceId, w: targetId });
        return { ...link, points: edge.points };
    });
    
    const graphWidth = g.graph().width || 500;
    const graphHeight = g.graph().height || 500;

    return { layoutedNodes, layoutedLinks, graphWidth, graphHeight };
}

function wrapText(selection: d3.Selection<d3.BaseType, LogicDiagramNode, SVGGElement, unknown>, width: number) {
    selection.each(function(d) {
        const text = d3.select(this);
        const words = d.label.split(/\s+/).reverse();
        let word;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // ems
        const y = text.attr("y") || 0;
        const dy = 0;
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if ((tspan.node() as SVGTextContentElement).getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + "em").text(word);
            }
        }
        
        const textBlockHeight = (lineNumber + 1) * 16;
        text.attr('transform', `translate(0, -${textBlockHeight / 2 - 8})`); // Adjust vertical centering
    });
}


export default LogicDiagram;