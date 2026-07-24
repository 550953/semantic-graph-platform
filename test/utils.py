"""
🐝 HoneyORM Graph Platform — Test Utilities
============================================
Вспомогательные функции для тестового фреймворка.
"""

import time
import json
import sys
from datetime import datetime
from typing import Optional, Callable, Any, Union
import requests
from colorama import Fore, Style

from config import config, BASE_URL, API_PREFIX


# ============ Stats Tracker ============

class TestStats:
    """
    Thread-safe test statistics tracker.
    Использует единый объект вместо глобальных переменных.
    """
    
    def __init__(self):
        self.passed: int = 0
        self.failed: int = 0
        self.skipped: int = 0
        self.start_time: datetime = datetime.now()
        self.results: list = []  # For JSON report
    
    def add_pass(self, name: str, duration_ms: float):
        """Record a passed test"""
        self.passed += 1
        self.results.append({
            "name": name,
            "status": "PASS",
            "duration_ms": round(duration_ms, 1)
        })
    
    def add_fail(self, name: str, error: str):
        """Record a failed test"""
        self.failed += 1
        self.results.append({
            "name": name,
            "status": "FAIL",
            "error": str(error)[:500]  # Truncate long errors
        })
    
    def add_skip(self, name: str, reason: str = ""):
        """Record a skipped test"""
        self.skipped += 1
        self.results.append({
            "name": name,
            "status": "SKIP",
            "reason": reason or "No reason provided"
        })
    
    @property
    def total(self) -> int:
        return self.passed + self.failed + self.skipped
    
    @property
    def duration(self) -> float:
        return (datetime.now() - self.start_time).total_seconds()
    
    @property
    def pass_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return self.passed / self.total * 100
    
    @property
    def is_clean(self) -> bool:
        """True if no failures"""
        return self.failed == 0
    
    def reset(self):
        """Reset all counters (for re-runs)"""
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.start_time = datetime.now()
        self.results = []


# Global stats instance
stats = TestStats()


# ============ Logger ============

class Logger:
    """
    Цветной консольный логгер.
    Поддерживает цвета (colorama) и plain-text вывод.
    """
    
    @staticmethod
    def section(title: str):
        """Print a section divider"""
        print(f"\n{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}{Style.BRIGHT}  {title}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
    
    @staticmethod
    def pass_test(name: str, duration_ms: float):
        """Log a passed test"""
        stats.add_pass(name, duration_ms)
        if config.use_colors:
            print(f"{Fore.GREEN}✅ PASS{Style.RESET_ALL} │ {name} ({duration_ms:.0f}ms)")
        else:
            print(f"PASS │ {name} ({duration_ms:.0f}ms)")
    
    @staticmethod
    def fail_test(name: str, error: str):
        """Log a failed test with error details"""
        stats.add_fail(name, error)
        if config.use_colors:
            print(f"{Fore.RED}❌ FAIL{Style.RESET_ALL} │ {name}")
            if error:
                for line in str(error).split('\n')[:3]:  # Max 3 lines
                    print(f"   {Fore.RED}└─ {line}{Style.RESET_ALL}")
        else:
            print(f"FAIL │ {name} — {error}")
    
    @staticmethod
    def skip_test(name: str, reason: str = ""):
        """Log a skipped test"""
        stats.add_skip(name, reason)
        msg = f"⏭️  SKIP │ {name}"
        if reason:
            msg += f" — {reason}"
        if config.use_colors:
            print(f"{Fore.YELLOW}{msg}{Style.RESET_ALL}")
        else:
            print(msg)
    
    @staticmethod
    def info(msg: str):
        """Log informational message"""
        if config.use_colors:
            print(f"{Fore.CYAN}ℹ️  {msg}{Style.RESET_ALL}")
        else:
            print(f"INFO: {msg}")
    
    @staticmethod
    def debug(msg: str):
        """Log debug message (only in verbose mode)"""
        if config.verbose:
            if config.use_colors:
                print(f"  {Fore.MAGENTA}🔍 {msg}{Style.RESET_ALL}")
            else:
                print(f"  DEBUG: {msg}")
    
    @staticmethod
    def warn(msg: str):
        """Log warning message"""
        if config.use_colors:
            print(f"{Fore.YELLOW}⚠️  {msg}{Style.RESET_ALL}")
        else:
            print(f"WARN: {msg}")
    
    @staticmethod
    def error(msg: str):
        """Log error message (non-test failure)"""
        if config.use_colors:
            print(f"{Fore.RED}💥 {msg}{Style.RESET_ALL}")
        else:
            print(f"ERROR: {msg}")


log = Logger()


# ============ API Test Helper ============

def api_test(
    name: str,
    method: Callable,
    path: str,
    expected_status: Union[int, list] = 200,
    data: Optional[dict] = None,
    headers: Optional[dict] = None,
    timeout: Optional[int] = None
) -> Optional[dict]:
    """
    Execute a single API test and log the result.
    
    Args:
        name: Human-readable test name
        method: requests.get, requests.post, requests.put, requests.delete
        path: API path (e.g., '/health', '/graphs')
        expected_status: Expected HTTP status code(s). Can be int or list of ints
        data: JSON body for POST/PUT/PATCH requests
        headers: Custom HTTP headers
        timeout: Request timeout in seconds (default from config)
    
    Returns:
        Parsed JSON response dict, or None on failure
    
    Examples:
        >>> api_test("Health", requests.get, "/health", 200)
        >>> api_test("Create", requests.post, "/graphs", 201, data={"name": "Test"})
        >>> api_test("Delete", requests.delete, "/graphs/123", [200, 204])
    """
    url = f"{BASE_URL}{API_PREFIX}{path}"
    timeout = timeout or config.request_timeout
    start = time.time()
    
    try:
        # Prepare headers
        headers = dict(headers) if headers else {}
        if "Content-Type" not in headers and data is not None:
            headers["Content-Type"] = "application/json"
        
        # Execute request
        response = method(url, json=data, headers=headers, timeout=timeout)
        duration_ms = (time.time() - start) * 1000
        
        # Normalize expected status to list
        expected_list = (
            expected_status 
            if isinstance(expected_status, (list, tuple)) 
            else [expected_status]
        )
        
        # Check status
        if response.status_code in expected_list:
            log.pass_test(name, duration_ms)
            
            # Try to parse JSON
            try:
                return response.json() if response.text else None
            except json.JSONDecodeError:
                # Response is not JSON (e.g., 204 No Content)
                return {"_raw": response.text} if response.text else None
        else:
            # Build error message
            error_parts = [
                f"Expected {expected_list}, got {response.status_code}"
            ]
            
            # Add response body for debugging
            if response.text:
                body = response.text[:300]
                if len(response.text) > 300:
                    body += "..."
                error_parts.append(f"Body: {body}")
            
            # Add hint for common errors
            if response.status_code == 404:
                error_parts.append("Hint: Endpoint or resource not found")
            elif response.status_code == 500:
                error_parts.append("Hint: Server error — check backend logs")
            elif response.status_code == 401:
                error_parts.append("Hint: Token expired or invalid")
            
            log.fail_test(name, "\n".join(error_parts))
            return None
            
    except requests.exceptions.ConnectionError:
        log.fail_test(
            name,
            "Connection refused — is the server running?\n"
            f"   URL: {url}"
        )
        return None
        
    except requests.exceptions.Timeout:
        log.fail_test(
            name,
            f"Request timeout after {timeout}s\n"
            f"   URL: {url}"
        )
        return None
        
    except requests.exceptions.TooManyRedirects:
        log.fail_test(name, "Too many redirects — check URL configuration")
        return None
        
    except Exception as e:
        log.fail_test(
            name,
            f"Unexpected error: {type(e).__name__}: {str(e)}"
        )
        return None


# ============ Auth Helpers ============

def login(token: Optional[str] = None) -> Optional[str]:
    """
    Login and return JWT token.
    
    Args:
        token: If provided, validates existing token instead of logging in
    
    Returns:
        JWT token string, or None on failure
    """
    from config import TEST_USER, TEST_PASS
    
    if token:
        log.info("Validating provided token...")
        result = api_test(
            "Token validation",
            requests.get,
            "/auth/me",
            200,
            headers={"Authorization": f"Bearer {token}"}
        )
        return token if result else None
    
    # Perform login
    result = api_test(
        "Login",
        requests.post,
        "/auth/login",
        200,
        {"email": TEST_USER, "password": TEST_PASS}
    )
    
    if not result:
        log.error("Login failed! Check TEST_USER and TEST_PASS in config.py")
        return None
    
    token = result.get("token")
    if not token:
        log.error("Login response missing 'token' field")
        return None
    
    log.debug(f"Token obtained: {token[:20]}...")
    return token


def auth_headers(token: str, extra: Optional[dict] = None) -> dict:
    """
    Create authorization headers with Bearer token.
    
    Args:
        token: JWT token string
        extra: Additional headers to merge (e.g., X-Graph-Id)
    
    Returns:
        Headers dict with Authorization and optional extras
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    if extra:
        headers.update(extra)
    
    return headers


# ============ Display ============

def print_banner():
    """Print test suite ASCII banner"""
    print(f"\n{Fore.YELLOW}{Style.BRIGHT}")
    print("╔══════════════════════════════════════════════════════╗")
    print("║   🐝  HoneyORM Graph Platform — API Test Suite     ║")
    print("║   Target: Graph Platform v2.4                      ║")
    print("╚══════════════════════════════════════════════════════╝")
    print(f"{Style.RESET_ALL}")
    
    log.info(f"Server:  {BASE_URL}")
    log.info(f"User:    {config.test_email}")
    log.info(f"Time:    {stats.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    if config.quick_mode:
        log.warn("Quick mode: AI tests will be skipped")
    
    if config.report_path:
        log.info(f"Report:  {config.report_path}")
    
    print()


def print_summary():
    """Print final test summary and optionally save JSON report"""
    print(f"\n{Fore.YELLOW}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}{Style.BRIGHT}  📊 Test Summary{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}{'='*60}{Style.RESET_ALL}\n")
    
    # Stats
    print(f"  ✅ Passed:   {Fore.GREEN}{stats.passed}{Style.RESET_ALL}")
    print(f"  ❌ Failed:   {Fore.RED}{stats.failed}{Style.RESET_ALL}")
    print(f"  ⏭️  Skipped:  {Fore.YELLOW}{stats.skipped}{Style.RESET_ALL}")
    print(f"  📊 Total:    {stats.total}")
    print(f"  ⏱️  Duration: {stats.duration:.1f}s")
    
    # Pass rate with color
    if stats.total > 0:
        rate = stats.pass_rate
        if rate >= 90:
            color = Fore.GREEN
        elif rate >= 70:
            color = Fore.YELLOW
        else:
            color = Fore.RED
        print(f"  📈 Pass rate: {color}{rate:.0f}%{Style.RESET_ALL}")
    
    # Save JSON report if requested
    if config.report_path:
        save_report()
    
    # Final verdict
    print()
    if stats.is_clean:
        print(f"{Fore.GREEN}{Style.BRIGHT}🎉 All tests PASSED!{Style.RESET_ALL}")
    else:
        print(f"{Fore.RED}{Style.BRIGHT}❌ {stats.failed} test(s) FAILED!{Style.RESET_ALL}")
    
    print()
    
    # Exit with appropriate code
    sys.exit(0 if stats.is_clean else 1)


def save_report():
    """Save test results to JSON file"""
    report = {
        "title": "HoneyORM Graph Platform — API Test Report",
        "version": "2.4",
        "timestamp": stats.start_time.isoformat(),
        "duration_s": round(stats.duration, 2),
        "server": BASE_URL,
        "summary": {
            "total": stats.total,
            "passed": stats.passed,
            "failed": stats.failed,
            "skipped": stats.skipped,
            "pass_rate": round(stats.pass_rate, 1)
        },
        "results": stats.results
    }
    
    try:
        with open(config.report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        log.info(f"Report saved: {config.report_path}")
    except OSError as e:
        log.warn(f"Failed to save report: {e}")


# ============ Backward Compatibility ============

def test(name: str, method: Callable, path: str,
         expected_status: Union[int, list] = 200,
         data: Optional[dict] = None,
         headers: Optional[dict] = None) -> Optional[dict]:
    """
    Legacy wrapper for backward compatibility.
    Use api_test() in new code.
    """
    return api_test(name, method, path, expected_status, data, headers)


def section(title: str):
    """
    Legacy wrapper for backward compatibility.
    Use log.section() in new code.
    """
    log.section(title)