#!/usr/bin/env node

/**
 * 微服务依赖关系图生成工具
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
 * node generate-service-dependency-graph.js dependencies.json
 * 
 * 3. 使用Graphviz生成图像:
 * dot -Tpng service-dependencies.dot -o service-dependencies.png
 */

const fs = require('fs');
const path = require('path');

// 检查命令行参数
if (process.argv.length < 3) {
  console.log('使用方法: node generate-service-dependency-graph.js <依赖关系JSON文件>');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'service-dependencies.dot';

try {
  // 读取依赖关系文件
  const dependenciesData = fs.readFileSync(inputFile, 'utf8');
  const dependencies = JSON.parse(dependenciesData);

  // 创建DOT文件内容
  let dotContent = 'digraph ServiceDependencies {\n';
  dotContent += '  rankdir=LR;\n'; // 从左到右的布局
  dotContent += '  nodesep=1.5;\n';
  dotContent += '  ranksep=1.5;\n';
  dotContent += '  splines="ortho";\n';
  dotContent += '  overlap=false;\n';
  dotContent += '  concentrate=true;\n';
  dotContent += '  node [shape=box, style=filled, fillcolor=lightblue];\n';

  // 添加所有服务节点
  const allServices = new Set();
  Object.keys(dependencies).forEach(service => {
    allServices.add(service);
    dependencies[service].forEach(dep => allServices.add(dep));
  });

  // 生成边
  Object.keys(dependencies).forEach(service => {
    dependencies[service].forEach(dependency => {
      dotContent += `  "${service}" -> "${dependency}";\n`;
    });
    // 如果服务没有依赖，确保它仍然显示在图中
    if (dependencies[service].length === 0) {
      dotContent += `  "${service}";\n`;
    }
  });

  // 确保所有被依赖但没有定义自己依赖的服务也显示出来
  allServices.forEach(service => {
    if (!dependencies[service]) {
      dotContent += `  "${service}";\n`;
    }
  });

  dotContent += '}\n';

  // 写入DOT文件
  fs.writeFileSync(outputFile, dotContent);
  console.log(`依赖关系图已生成到: ${outputFile}`);
  console.log('使用以下命令生成图片:');
  console.log(`dot -Tpng ${outputFile} -o service-dependencies.png`);

} catch (error) {
  console.error('错误:', error.message);
  process.exit(1);
}
