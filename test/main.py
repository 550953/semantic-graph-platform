

import sys
import time as time_module
from datetime import datetime
from colorama import init, Fore, Style
import requests

from config import config, BASE_URL, API_PREFIX, TEST_USER, TEST_PASS
from utils import (
    stats, log, api_test, login, auth_headers,
    print_banner, print_summary
)

init(autoreset=True)


def test_health():
    log.section("🏥 Health Check")
    api_test("Server health", requests.get, "/health", 200)


def test_auth():
    log.section("🔐 Authentication")
    
    api_test(
        "Register user",
        requests.post,
        "/auth/register",
        [200, 201, 400, 409],
        {
            "email": TEST_USER,
            "password": TEST_PASS,
            "name": "Test Admin"
        }
    )
    
    token = login()
    if not token:
        log.error("Cannot obtain auth token")
        return None
    
    api_test(
        "Get profile",
        requests.get,
        "/auth/me",
        200,
        headers=auth_headers(token)
    )
    
    return token


def test_graphs(token):
    log.section("📊 Graphs CRUD")
    headers = auth_headers(token)
    
    api_test("List graphs", requests.get, "/graphs", 200, headers=headers)
    
    new_graph = api_test(
        "Create graph",
        requests.post,
        "/graphs",
        201,
        {
            "name": f"AutoTest_{int(time_module.time())}",
            "description": "Created by test suite"
        },
        headers=headers
    )
    
    if new_graph and new_graph.get("id"):
        api_test(
            "Delete graph",
            requests.delete,
            f"/graphs/{new_graph['id']}",
            [200, 204],
            headers=headers
        )
    else:
        log.skip_test("Delete graph", "No graph created")


def test_nodes_and_edges(token):
    log.section("🔷 Nodes & Edges")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get nodes (tobe)", requests.get, "/graph/nodes?tab=tobe&graph_id=graph-default", 200, headers=headers)
    api_test("Get nodes (asis)", requests.get, "/graph/nodes?tab=asis&graph_id=graph-default", 200, headers=headers)
    api_test("Get edges", requests.get, "/graph/edges?tab=tobe&graph_id=graph-default", 200, headers=headers)
    api_test("Get actors", requests.get, "/actors", 200, headers=headers)
    api_test("Get work items", requests.get, "/work-items", 200, headers=headers)


def test_fsm(token):
    log.section("🔄 FSM")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    machines = api_test("Get FSM machines", requests.get, "/fsm/machines", 200, headers=headers)
    
    if machines and isinstance(machines, list) and len(machines) > 0:
        machine = machines[0]
        machine_id = machine.get("id") or machine.get("name") or machine.get("state")
        
        if machine_id:
            api_test(
                "Get transitions",
                requests.get,
                f"/fsm/{machine_id}/transitions",
                200,
                headers=headers
            )
    else:
        log.skip_test("FSM transitions", "No machines found")


def test_ontology(token):
    log.section("🧠 Ontology")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get ontology", requests.get, "/ontology", 200, headers=headers)
    
    api_test(
        "Extend ontology",
        requests.post,
        "/ontology/extend",
        [200, 201],
        {
            "concepts": ["TestConcept"],
            "relations": [{"from": "TestConcept", "to": "Actor", "label": "TESTED_BY"}]
        },
        headers=headers
    )


def test_rag(token):
    log.section("🔍 RAG")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get documents", requests.get, "/rag/documents", 200, headers=headers)
    api_test("Search documents", requests.get, "/rag/search?q=test", 200, headers=headers)


def test_copilot(token):
    log.section("🤖 AI Copilot")
    
    if config.quick_mode:
        log.skip_test("AI Copilot", "Quick mode")
        return
    
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get chat history", requests.get, "/copilot/history", 200, headers=headers)
    api_test(
        "Send chat message",
        requests.post,
        "/copilot/chat",
        200,
        {"message": "Hello!"},
        headers=headers,
        timeout=config.ai_timeout
    )


def test_ratings(token):
    log.section("⭐ Ratings & Reviews")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get reviews", requests.get, "/reviews", 200, headers=headers)
    api_test("Get ratings", requests.get, "/ratings", 200, headers=headers)


def test_admin(token):
    log.section("👑 Admin Panel")
    headers = auth_headers(token)
    
    api_test("Admin summary", requests.get, "/admin/summary", 200, headers=headers)
    api_test("Admin users", requests.get, "/admin/users", 200, headers=headers)


def test_security(token):
    log.section("🛡️ Security")
    
    api_test("No token — 401", requests.get, "/auth/me", 401)
    api_test("No token — 401", requests.get, "/graphs", 401)
    
    api_test(
        "Bad token — 401",
        requests.get,
        "/auth/me",
        401,
        headers={"Authorization": "Bearer invalid_token_xyz"}
    )
    
    log.info("Testing rate limit...")
    headers = auth_headers(token) if token else {}
    rate_limited = False
    
    for i in range(config.rate_limit_requests):
        try:
            r = requests.get(f"{BASE_URL}{API_PREFIX}/health", headers=headers, timeout=5)
            if r.status_code == 429:
                log.pass_test("Rate limit triggered", (i + 1) * 10)
                rate_limited = True
                break
        except requests.exceptions.ConnectionError:
            log.fail_test("Rate limit test", "Connection failed")
            return
    
    if not rate_limited:
        log.skip_test("Rate limit", f"Not triggered after {config.rate_limit_requests} requests")


def test_role_bindings(token):
    log.section("🔗 Role Bindings")
    headers = auth_headers(token, {"X-Graph-Id": "graph-default"})
    
    api_test("Get role bindings", requests.get, "/role-bindings", 200, headers=headers)


def test_workspaces(token):
    log.section("🏢 Workspaces")
    headers = auth_headers(token)
    
    api_test("List workspaces", requests.get, "/workspaces", 200, headers=headers)


TEST_GROUPS = [
    test_health,
    test_auth,
    test_graphs,
    test_nodes_and_edges,
    test_fsm,
    test_ontology,
    test_rag,
    test_copilot,
    test_ratings,
    test_role_bindings,
    test_workspaces,
    test_admin,
    test_security,
]


def main():
    print_banner()
    
    token = None
    
    for test_func in TEST_GROUPS:
        try:
            if test_func == test_auth:
                token = test_func()
                if not token:
                    log.error("Auth failed. Stopping.")
                    break
            elif test_func in (test_graphs, test_nodes_and_edges, test_fsm,
                               test_ontology, test_rag, test_copilot,
                               test_ratings, test_role_bindings, test_workspaces,
                               test_admin):
                if token:
                    test_func(token)
                else:
                    log.skip_test(test_func.__name__, "No token")
            elif test_func == test_security:
                test_func(token)
            else:
                test_func()
        except Exception as e:
            log.fail_test(test_func.__name__, str(e))
    
    print_summary()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}⚠️  Interrupted{Style.RESET_ALL}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Fore.RED}💥 Fatal: {e}{Style.RESET_ALL}")
        sys.exit(2)