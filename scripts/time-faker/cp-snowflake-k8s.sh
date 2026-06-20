#!/bin/sh

# 基于 Kubernetes 的 Snowflake 文件拷贝脚本
# 将 Snowflake.js 和 SnowflakeSI.js 拷贝到各服务并重启以加载新代码
# 前置条件: deployment 必须将 /data 或目标路径挂载为 volume，否则重启会重置容器导致文件丢失
# 用法: $0 [namespace] [源文件目录]
# 示例: ./cp-snowflake-k8s.sh
# 示例: ./cp-snowflake-k8s.sh cloud-reolink-r6
# 示例: ./cp-snowflake-k8s.sh cloud-reolink-r6 /path/to/files

NAMESPACE=${1:-default}
SRC_DIR=${2:-.}
KUBECTL_NS="-n $NAMESPACE"
REMOTE_PATH="/data/node_modules/@litert/uuid/lib"

# 需要拷贝文件并重启的 deployment 列表
DEPLOYMENTS="
svc-cloud-subscriptions
svc-sim-card
"

SNOWFLAKE_JS="$SRC_DIR/Snowflake.js"
SNOWFLAKE_SI_JS="$SRC_DIR/SnowflakeSI.js"

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

get_pod() {
    kubectl get pods $KUBECTL_NS --no-headers 2>/dev/null | awk -v dep="$1" '$1 ~ "^" dep "-" {print $1; exit}'
}

# 1. 拷贝文件（Node.js 需重启才能加载新模块，因此必须配合 step2）
echo "step 1: copying files..."

for dep in $DEPLOYMENTS; do
    pod=$(get_pod "$dep")
    if [ -z "$pod" ]; then
        echo "  $dep: 未找到运行中的 pod，跳过"
        continue
    fi

    echo "  -> $dep ($pod)"

    kubectl cp "$SNOWFLAKE_JS" "$NAMESPACE/$pod:$REMOTE_PATH/Snowflake.js" 2>/dev/null || echo "    Snowflake.js 拷贝失败"
    kubectl cp "$SNOWFLAKE_SI_JS" "$NAMESPACE/$pod:$REMOTE_PATH/SnowflakeSI.js" 2>/dev/null || echo "    SnowflakeSI.js 拷贝失败"
done

# 2. 重启以使 Node.js 进程加载新代码（需 /data 挂载 volume，否则重启会重置容器导致文件丢失）
echo ""
echo "step 2: restarting pods to load new code..."

for dep in $DEPLOYMENTS; do
    pods=$(kubectl get pods $KUBECTL_NS --no-headers 2>/dev/null | awk -v d="$dep" '$1 ~ "^" d "-" {print $1}')
    for pod in $pods; do
        [ -n "$pod" ] && kubectl exec $KUBECTL_NS "$pod" -- kill -TERM 1 2>/dev/null &
    done
done
wait

echo "waiting for pods to be ready..."
for dep in $DEPLOYMENTS; do
    pods=$(kubectl get pods $KUBECTL_NS --no-headers 2>/dev/null | awk -v d="$dep" '$1 ~ "^" d "-" {print $1}')
    for pod in $pods; do
        [ -n "$pod" ] && kubectl wait --for=condition=Ready pod/"$pod" $KUBECTL_NS --timeout=120s 2>/dev/null && echo "  $pod ready" || echo "  $pod wait timeout or failed"
    done
done

echo ""
echo "done"
