#!/bin/sh

# 基于 Kubernetes 的恢复原始时间脚本
# 用法: $0 [namespace]
# 示例: ./restore-time-k8s.sh
# 示例: ./restore-time-k8s.sh cloud-reolink-r6

NAMESPACE=${1:-default}
KUBECTL_NS="-n $NAMESPACE"

# 需要执行 restore-original-time 的 deployment 列表
RESTORE_DEPLOYMENTS="
svc-cloud-subscriptions
svc-sim-card
"
# svc-sim-card-telenor-accounting-i0

# 需要重启的 deployment 列表（对应原 docker-compose 中的服务）
RESTART_DEPLOYMENTS="
svc-sim-card
"

echo "namespace: $NAMESPACE"
echo "restoring original time..."

for dep in $RESTORE_DEPLOYMENTS; do
    echo "  -> $dep"
    kubectl exec $KUBECTL_NS deployment/"$dep" -- npx reolink control command restore-original-time '{}' 2>/dev/null || echo "    (skip or failed: 请确认 deployment 名称和 namespace)"
done

echo ""
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
echo "done"
