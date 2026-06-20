#!/bin/sh

# 基于 Kubernetes 的时间设置脚本
# 用法: $0 [时间参数 (YYYY-MM-DD)] [namespace]
# 示例: ./set-time-k8s.sh
# 示例: ./set-time-k8s.sh 2025-02-26
# 示例: ./set-time-k8s.sh 2025-02-26 dev

if [ -z "$1" ]; then
    printf "请输入时间参数 (YYYY-MM-DD): "
    read -r TIME_PARAM
    if [ -z "$TIME_PARAM" ]; then
        echo "错误: 时间参数不能为空"
        exit 1
    fi
    NAMESPACE=${2:-default}
else
    TIME_PARAM=$1
    NAMESPACE=${2:-default}
fi
KUBECTL_NS="-n $NAMESPACE"

# 需要重启的 deployment 列表（对应原 docker-compose 中的服务）
# 请根据实际 k8s 部署名称调整
RESTART_DEPLOYMENTS="
svc-sim-card
"

# 需要执行 set-current-time 的 deployment 列表
SET_TIME_DEPLOYMENTS="
svc-cloud-subscriptions
svc-sim-card
"

echo "namespace: $NAMESPACE"
echo "restarting pods (in-place, one by one)..."

for dep in $RESTART_DEPLOYMENTS; do
    pods=$(kubectl get pods $KUBECTL_NS --no-headers 2>/dev/null | awk -v d="$dep" '$1 ~ "^" d "-" {print $1}')
    for pod in $pods; do
        if [ -n "$pod" ]; then
            echo "  -> $pod restarting..."
            kubectl exec $KUBECTL_NS "$pod" -- kill -TERM 1 2>/dev/null
            sleep 2
            kubectl wait --for=condition=Ready pod/"$pod" $KUBECTL_NS --timeout=120s 2>/dev/null && echo "  $pod ready" || echo "  $pod wait timeout or failed"
        fi
    done
done

echo "restarting complete"
echo "setting current time to $TIME_PARAM..."

for dep in $SET_TIME_DEPLOYMENTS; do
    echo "  -> $dep"
    kubectl exec $KUBECTL_NS deployment/"$dep" -- npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}" 2>/dev/null || echo "    (skip or failed: 请确认 deployment 名称和 namespace)"
done

echo "done"
