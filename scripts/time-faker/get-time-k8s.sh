#!/bin/sh

# 基于 Kubernetes 的获取当前时间脚本
# 用法: $0 [namespace]
# 示例: ./get-time-k8s.sh
# 示例: ./get-time-k8s.sh dev

NAMESPACE=${1:-default}
KUBECTL_NS="-n $NAMESPACE"

# 需要执行 get-current-time 的 deployment 列表
GET_TIME_DEPLOYMENTS="
svc-cloud-subscriptions
svc-sim-card
"
# svc-sim-card-telenor-accounting-i0

echo "namespace: $NAMESPACE"
echo "getting current time from services..."
echo ""

for dep in $GET_TIME_DEPLOYMENTS; do
    echo "=== $dep ==="
    kubectl exec $KUBECTL_NS deployment/"$dep" -- npx reolink control command get-current-time '{}' 2>/dev/null || echo "  (skip or failed: 请确认 deployment 名称和 namespace)"
    echo ""
done

echo "done"
