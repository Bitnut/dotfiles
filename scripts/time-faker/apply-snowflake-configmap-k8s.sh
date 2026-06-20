#!/bin/sh

# 基于 ConfigMap 的 Snowflake 文件部署脚本
# 创建/更新 ConfigMap 并重启 deployment 以加载新代码
# 前置条件: deployment 需已配置挂载 snowflake-files ConfigMap（使用 subPath 挂载 Snowflake.js 和 SnowflakeSI.js）
# 用法: $0 [namespace] [源文件目录]
# 示例: ./apply-snowflake-configmap-k8s.sh
# 示例: ./apply-snowflake-configmap-k8s.sh cloud-reolink-r6

NAMESPACE=${1:-default}
SRC_DIR=${2:-.}
KUBECTL_NS="-n $NAMESPACE"
CONFIGMAP_NAME="snowflake-files"

SNOWFLAKE_JS="$SRC_DIR/Snowflake.js"
SNOWFLAKE_SI_JS="$SRC_DIR/SnowflakeSI.js"

# 需要更新的 deployment 列表
DEPLOYMENTS="
svc-cloud-subscriptions
svc-sim-card
"

if [ ! -f "$SNOWFLAKE_JS" ]; then
    echo "错误: 找不到 $SNOWFLAKE_JS"
    exit 1
fi

if [ ! -f "$SNOWFLAKE_SI_JS" ]; then
    echo "错误: 找不到 $SNOWFLAKE_SI_JS"
    exit 1
fi

echo "namespace: $NAMESPACE"
echo "source dir: $SRC_DIR"
echo ""

# 1. 创建或更新 ConfigMap
echo "step 1: creating/updating ConfigMap $CONFIGMAP_NAME..."

kubectl create configmap $CONFIGMAP_NAME \
  --from-file=Snowflake.js="$SNOWFLAKE_JS" \
  --from-file=SnowflakeSI.js="$SNOWFLAKE_SI_JS" \
  $KUBECTL_NS \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. 重启 deployment 以加载新文件
echo ""
echo "step 2: restarting deployments to load new code..."

for dep in $DEPLOYMENTS; do
    echo "  -> $dep"
    kubectl rollout restart deployment/"$dep" $KUBECTL_NS 2>/dev/null || echo "    (skip or failed)"
done

echo ""
echo "waiting for rollout..."
for dep in $DEPLOYMENTS; do
    kubectl rollout status deployment/"$dep" $KUBECTL_NS --timeout=120s 2>/dev/null || true
done

echo ""
echo "done"
