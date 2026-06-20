#!/usr/bin/env node

/**
 * 微服务依赖关系图生成工具 (增强版)
 * 
 * 使用方法:
 * 1. 创建一个依赖关系文件 dependencies.json:
 * {
 *   "ServiceA": ["ServiceB", "ServiceC"],
 *   "ServiceB": ["ServiceD"],
 *   "ServiceC": [],
 *   "ServiceD": []
 * }
 * 
 * 2. 运行此脚本:
 * node generate-service-dependency-graph.js dependencies.json [输出文件.dot] [布局引擎] [聚焦服务] [集群阈值]
 * 
 * 参数说明:
 * - 布局引擎: dot(默认), fdp, circo, neato, twopi, osage
 * - 聚焦服务: 如果提供，会高亮该服务及其直接依赖
 * - 集群阈值: 被依赖次数超过此值的服务会形成集群，设为0禁用集群功能
 * 
 * 示例:
 * node generate-service-dependency-graph.js dependencies.json services.dot fdp ServiceA 4
 * 
 * 3. 使用Graphviz生成图像:
 * dot -Tpng service-dependencies.dot -o service-dependencies.png
 * 或者使用其他引擎:
 * fdp -Tsvg service-dependencies.dot -o service-dependencies.svg
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 检查命令行参数
if (process.argv.length < 3) {
  console.log('使用方法: node generate-service-dependency-graph.js <依赖关系JSON文件> [输出文件.dot] [布局引擎] [聚焦服务]');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'service-dependencies.dot';
const layoutEngine = process.argv[4] || 'dot'; // dot, fdp, circo, neato, twopi, osage
const focusService = process.argv[5]; // 可选的聚焦服务
const clusterThresholdArg = parseInt(process.argv[6]); // 可选的集群阈值

// 配置选项
const config = {
  // 布局方向: TB (top to bottom), LR (left to right), BT, RL
  rankdir: 'TB',
  // 节点间距
  nodesep: 0.5,
  // 层级间距
  ranksep: 1.0,
  // 节点形状: box, ellipse, circle, diamond, etc.
  nodeShape: 'box',
  // 边线样式: solid, dashed, dotted
  edgeStyle: 'solid',
  // 是否使用拼接边 (在图表中合并共同路径)
  splines: 'ortho', // 'line', 'polyline', 'curved', 'ortho', 'spline'
  // 集群数量级别，大于此值的依赖关系将被归为集群
  clusterThreshold: 3,
  // 输出图片格式
  outputFormat: 'png'
};

// 颜色配置
const colors = {
  defaultNode: '#E8F0FE',
  rootNode: '#D7E9FF',
  leafNode: '#D9EAD3',
  focusNode: '#FFF2CC',
  focusDependency: '#FCE5CD',
  cluster: '#F3F3F3',
  edge: '#666666'
};

try {
  // 读取依赖关系文件
  const dependenciesData = fs.readFileSync(inputFile, 'utf8');
  const dependencies = JSON.parse(dependenciesData);

  // 分析图表复杂度，调整布局参数
  const nodeCount = Object.keys(dependencies).length;
  const edgeCount = Object.keys(dependencies).reduce((acc, service) => {
    return acc + dependencies[service].length;
  }, 0);
  
  // 针对大型图表自动调整参数
  if (nodeCount > 20) {
    config.nodesep = 0.8;
    config.ranksep = 1.5;
  }
  if (edgeCount > 50) {
    config.splines = 'spline'; // 使用曲线减少混乱
  }
  
  // 如果图表特别复杂，默认使用fdp引擎而非dot
  if (nodeCount > 30 && edgeCount > 80 && layoutEngine === 'dot') {
    console.log('检测到复杂图表，建议使用 fdp 布局引擎替代 dot');
  }
  
  // 设置集群阈值：如果指定了命令行参数，则使用指定的值
  if (!isNaN(clusterThresholdArg)) {
    config.clusterThreshold = clusterThresholdArg;
    // 如果阈值设为0，表示禁用集群功能
    if (clusterThresholdArg === 0) {
      console.log('集群功能已禁用（阈值=0）');
    }
  } 
  // 否则根据图表大小自动调整
  else if (nodeCount > 30) {
    config.clusterThreshold = 5; // 大图表提高阈值，减少集群数量
  } else if (nodeCount < 10) {
    config.clusterThreshold = 2; // 小图表降低阈值
  }

  // 创建DOT文件内容
  let dotContent = `digraph ServiceDependencies {\n`;
  dotContent += `  // 图表设置\n`;
  dotContent += `  rankdir="${config.rankdir}";\n`;
  dotContent += `  nodesep=${config.nodesep};\n`;
  dotContent += `  ranksep=${config.ranksep};\n`;
  dotContent += `  splines="${config.splines}";\n`;
  dotContent += `  overlap=false;\n`;
  dotContent += `  concentrate=true;\n\n`;
  
  // 基础节点样式
  dotContent += `  // 节点样式\n`;
  dotContent += `  node [shape=${config.nodeShape}, style="filled,rounded", fontname="Arial", fontsize=11, color="#AAAAAA", penwidth=0.8];\n`;
  dotContent += `  edge [style="${config.edgeStyle}", color="${colors.edge}", penwidth=0.6, arrowsize=0.8];\n\n`;

  // 添加所有服务节点并识别根节点和叶节点
  const allServices = new Set();
  Object.keys(dependencies).forEach(service => {
    allServices.add(service);
    dependencies[service].forEach(dep => allServices.add(dep));
  });

  // 找出根节点（没有被其他服务依赖的节点）和叶节点（不依赖其他服务的节点）
  const dependedBy = new Map(); // 哪些服务依赖此服务
  Object.keys(dependencies).forEach(service => {
    dependencies[service].forEach(dep => {
      if (!dependedBy.has(dep)) {
        dependedBy.set(dep, new Set());
      }
      dependedBy.get(dep).add(service);
    });
  });

  const rootNodes = [...allServices].filter(service => !dependedBy.has(service));
  const leafNodes = [...allServices].filter(service => 
    dependencies[service] && dependencies[service].length === 0
  );

  // 识别高频依赖的服务（被多个服务依赖的）
  // 限制最大集群数量，以避免图表过于复杂
  const maxClusters = 5; // 最多创建5个集群
  
  const highDependencyServices = [...dependedBy.entries()]
    .filter(([_, dependents]) => dependents.size > config.clusterThreshold)
    .sort(([_, dependentsA], [__, dependentsB]) => dependentsB.size - dependentsA.size) // 按被依赖数量降序排序
    .slice(0, maxClusters) // 限制最大集群数量
    .map(([service]) => service);

  // 添加聚焦服务的依赖关系
  const focusRelated = new Set();
  if (focusService) {
    if (dependencies[focusService]) {
      dependencies[focusService].forEach(dep => focusRelated.add(dep));
    }
    if (dependedBy.has(focusService)) {
      dependedBy.get(focusService).forEach(dep => focusRelated.add(dep));
    }
  }

  // 生成节点定义
  dotContent += `  // 节点定义\n`;
  allServices.forEach(service => {
    let color = colors.defaultNode;
    let fontStyle = 'normal';
    let fontWeight = 'normal';
    
    if (rootNodes.includes(service)) {
      color = colors.rootNode;
      fontWeight = 'bold';
    }
    if (leafNodes.includes(service)) {
      color = colors.leafNode;
    }
    if (service === focusService) {
      color = colors.focusNode;
      fontStyle = 'bold';
      fontWeight = 'bold';
    } else if (focusService && focusRelated.has(service)) {
      color = colors.focusDependency;
    }
    
    dotContent += `  "${service}" [fillcolor="${color}", fontname="Arial ${fontWeight}", fontsize=11, style="filled,rounded"];\n`;
  });

  // 解决集群重叠问题：跟踪每个服务被分配到的集群
  const serviceToCluster = new Map();
  
  // 首先，为高频依赖的服务创建集群（但暂时不写入DOT内容）
  // 确保每个服务只属于一个集群，优先级基于依赖项数量
  const clusters = new Map(); // 每个集群包含的服务

  // 按照被依赖数量排序服务，被依赖最多的优先分配
  const sortedHighDependencyServices = [...highDependencyServices].sort((a, b) => {
    const countA = dependedBy.has(a) ? dependedBy.get(a).size : 0;
    const countB = dependedBy.has(b) ? dependedBy.get(b).size : 0;
    return countB - countA;
  });

  // 为每个高频依赖服务创建一个集群
  sortedHighDependencyServices.forEach(service => {
    if (!dependedBy.has(service)) return;
    
    // 每个集群以自己为中心
    const clusterName = `cluster_${service.replace(/[^a-zA-Z0-9]/g, '_')}`;
    clusters.set(clusterName, new Set([service]));
    serviceToCluster.set(service, clusterName);
    
    // 添加依赖该服务但还没有被分配到其他集群的服务
    dependedBy.get(service).forEach(dependent => {
      if (dependencies[dependent].includes(service) && !serviceToCluster.has(dependent)) {
        clusters.get(clusterName).add(dependent);
        serviceToCluster.set(dependent, clusterName);
      }
    });
  });
  
  // 现在生成集群的DOT内容
  clusters.forEach((services, clusterName) => {
    const service = clusterName.replace('cluster_', '').replace(/_/g, '');
    
    dotContent += `\n  // 创建 ${service} 的依赖组\n`;
    dotContent += `  subgraph ${clusterName} {\n`;
    dotContent += `    label="${service} Dependencies";\n`;
    dotContent += `    style="filled,rounded";\n`;
    dotContent += `    color="#DDDDDD";\n`;
    dotContent += `    fillcolor="${colors.cluster}";\n`;
    dotContent += `    fontname="Arial";\n`;
    dotContent += `    fontsize=10;\n\n`;
    
    // 添加该集群中的所有服务节点
    services.forEach(svc => {
      let fillColor = colors.defaultNode;
      let fontStyle = "Arial";
      
      if (svc === service) {
        fontStyle = "Arial bold";
      }
      
      dotContent += `    "${svc}" [fillcolor="${fillColor}", fontname="${fontStyle}"];\n`;
    });
    
    dotContent += `  }\n`;
  });
  
  // 生成边 (依赖关系)
  dotContent += `\n  // 依赖关系定义\n`;
  Object.keys(dependencies).forEach(service => {
    dependencies[service].forEach(dependency => {
      let style = config.edgeStyle;
      let color = colors.edge;
      let penwidth = 0.6;
      
      // 如果是聚焦服务的依赖关系，突出显示
      if (service === focusService || (focusService && dependency === focusService)) {
        style = 'bold';
        color = '#FF6B6B';
        penwidth = 1.2;
      }
      
      dotContent += `  "${service}" -> "${dependency}" [style="${style}", color="${color}", penwidth=${penwidth}];\n`;
    });
    
    // 如果服务没有依赖，确保它仍然显示在图中
    if (dependencies[service].length === 0) {
      dotContent += `  "${service}" [style="filled,rounded", fillcolor="${colors.leafNode}"];\n`;
    }
  });

  // 确保所有被依赖但没有定义自己依赖的服务也显示出来
  allServices.forEach(service => {
    if (!dependencies[service]) {
      dotContent += `  "${service}" [style="filled,rounded,dashed", fillcolor="${colors.leafNode}", fontcolor="#666666"];\n`;
    }
  });

  dotContent += `}\n`;

  // 写入DOT文件
  fs.writeFileSync(outputFile, dotContent);
  console.log(`依赖关系图已生成到: ${outputFile}`);

  // 生成图片
  const imageFile = outputFile.replace(/\.dot$/, '') + '.' + config.outputFormat;
  const cmd = `${layoutEngine} -T${config.outputFormat} "${outputFile}" -o "${imageFile}"`;
  
  try {
    console.log(`正在使用 ${layoutEngine} 引擎生成图片...`);
    console.log(`执行: ${cmd}`);
    execSync(cmd);
    console.log(`图片已生成: ${imageFile}`);
    
    // 提供其他布局引擎选项
    console.log('\n尝试其他布局引擎:');
    console.log('1. dot - 层次布局 (默认，适合大多数层级关系)');
    console.log('2. fdp - 力导向布局 (适合较稀疏的图)');
    console.log('3. circo - 环形布局 (适合环状关系)');
    console.log('4. neato - 基于物理模拟的布局 (适合密集的图)');
    console.log('5. twopi - 径向布局 (从中心向外辐射)');
    
    console.log('\n使用示例:');
    console.log(`node generate-service-dependency-graph.js ${inputFile} ${outputFile} fdp [聚焦服务名]`);
    console.log(`或直接生成图片: fdp -T${config.outputFormat} "${outputFile}" -o "fdp-${imageFile}"`);
    
    // 提示聚焦服务选项
    if (!focusService && Object.keys(dependencies).length > 5) {
      console.log('\n提示: 如需关注特定服务及其依赖，可以添加聚焦服务参数:');
      console.log(`node generate-service-dependency-graph.js ${inputFile} ${outputFile} ${layoutEngine} <服务名>`);
    }
    
  } catch (error) {
    console.error('生成图片时出错:', error.message);
    console.log('请确保已安装 Graphviz 工具包。');
    console.log('安装方法: sudo apt-get install graphviz 或 sudo yum install graphviz');
  }

} catch (error) {
  console.error('错误:', error.message);
  process.exit(1);
}
