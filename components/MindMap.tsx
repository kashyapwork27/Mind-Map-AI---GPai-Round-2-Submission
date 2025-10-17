import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { MindMapNode } from '../types';

interface MindMapProps {
  data: MindMapNode;
}

const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 20, right: 200, bottom: 20, left: 100 };

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('background-color', 'transparent')
      .style('user-select', 'none');

    // Clear previous render
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const tree = d3.tree<MindMapNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    const root = d3.hierarchy(data);
    
    // Store children on a temporary property (_children) and collapse initial nodes.
    // This avoids mutating the original data prop.
    root.descendants().forEach((d: any, i) => {
        d.id = i;
        d._children = d.children;
        if (d.depth >= 2) {
            d.children = null;
        }
    });

    const link = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#4f4f52')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    const node = g.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3);
      
    const update = (source: d3.HierarchyPointNode<MindMapNode>) => {
      const duration = 500;
      const t = g.transition().duration(duration);
      
      const descendants = root.descendants();
      const links = root.links();
      
      tree(root);

      const linkGenerator = d3.linkHorizontal<any, d3.HierarchyPointNode<MindMapNode>>()
          .x(d => d.y)
          .y(d => d.x);

      const nodeSelection = node.selectAll<SVGGElement, d3.HierarchyPointNode<MindMapNode>>('g')
        .data(descendants, (d: any) => d.id);
        
      const linkSelection = link.selectAll('path')
        .data(links, (d: any) => d.target.id);

      // Enter new links
      const linkEnter = linkSelection.enter().append('path')
        .attr('d', () => {
          const o = { x: source.x0, y: source.y0 };
          return linkGenerator({ source: o, target: o } as any);
        });

      linkSelection.merge(linkEnter).transition(t)
        .attr('d', linkGenerator as any);

      // Exit links
      linkSelection.exit().transition(t).remove()
        .attr('d', () => {
          const o = { x: source.x, y: source.y };
          return linkGenerator({ source: o, target: o } as any);
        });

      // Enter new nodes
      const nodeEnter = nodeSelection.enter().append('g')
        .attr('transform', `translate(${source.y0},${source.x0})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0)
        .on('click', (event, d: any) => {
          // Toggle children using the temporary _children property
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
          }
          update(d);
        });

      nodeEnter.append('circle')
        .attr('r', d => d.depth === 0 ? 12 : 8)
        .attr('fill', d => d._children ? '#0ea5e9' : '#334155')
        .attr('stroke', d => d.depth === 0 ? '#67e8f9' : '#64748b');

      nodeEnter.append('text')
        .attr('dy', '0.31em')
        .attr('x', 15)
        .attr('text-anchor', 'start')
        .text(d => d.data.name)
        .attr('fill', '#e2e8f0')
        .style('font-size', '16px')
        .style('font-weight', d => d.depth === 0 ? 'bold' : 'normal');

      // Transition nodes to their new position.
      const nodeUpdate = nodeSelection.merge(nodeEnter);
      
      nodeUpdate.transition(t)
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .attr('fill-opacity', 1)
        .attr('stroke-opacity', 1);

      nodeUpdate.select('circle')
        .transition(t)
        .attr('fill', d => d.children ? '#0ea5e9' : '#334155');
        
      // Transition exiting nodes to the parent's new position.
      nodeSelection.exit().transition(t).remove()
        .attr('transform', `translate(${source.y},${source.x})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0);
        
      root.eachBefore((d: any) => {
          d.x0 = d.x;
          d.y0 = d.y;
      });
    };

    root.x0 = (height - margin.top - margin.bottom) / 2;
    root.y0 = 0;
    update(root as any);
    
    // Zoom/Pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom)
      .call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));


  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default MindMap;