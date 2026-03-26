INSERT OR IGNORE INTO script_templates (feature_type, template_name, template_content, description, is_default) VALUES
('API', 'Default API Template',
'*** Settings ***
Library    RequestsLibrary
Library    JSONLibrary
Library    Collections
Library    String

*** Variables ***
${BASE_URL}      %{BASE_URL}
${TIMEOUT}       30
${AUTH_TOKEN}    %{AUTH_TOKEN}

*** Keywords ***
Create API Session
    Create Session    tamt    ${BASE_URL}    verify=True

Validate Response Status
    [Arguments]    ${response}    ${expected_status}
    Should Be Equal As Integers    ${response.status_code}    ${expected_status}

Validate JSON Schema
    [Arguments]    ${response_body}    ${schema_path}
    ${schema}=    Load JSON From File    ${schema_path}
    Validate    ${response_body}    ${schema}

*** Test Cases ***
# AGENT GENERATES CASES BELOW THIS LINE
',
'Base template for API test scripts using RequestsLibrary', 1),

('Functional', 'Default Functional Template',
'*** Settings ***
Library    BuiltIn
Library    Collections
Library    String
Library    OperatingSystem
Library    DateTime

*** Variables ***
${ENV}           %{ENV}
${TEST_DATA}     %{TEST_DATA_PATH}

*** Keywords ***
Log Test Context
    [Arguments]    ${context}
    Log    Test Context: ${context}    INFO

Verify Condition
    [Arguments]    ${actual}    ${expected}    ${msg}=Condition failed
    Should Be Equal    ${actual}    ${expected}    msg=${msg}

*** Test Cases ***
# AGENT GENERATES CASES BELOW THIS LINE
',
'Base template for functional test scripts', 1),

('GUI', 'Default GUI Template',
'*** Settings ***
Library    SeleniumLibrary
Library    Collections
Library    String

*** Variables ***
${BROWSER}       chrome
${BASE_URL}      %{BASE_URL}
${IMPLICIT_WAIT} 10

Suite Setup     Open Browser    ${BASE_URL}    ${BROWSER}
Suite Teardown  Close All Browsers

*** Keywords ***
Navigate To Page
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait Until Page Contains Element    tag:body

Screenshot On Failure
    Capture Page Screenshot

*** Test Cases ***
# AGENT GENERATES CASES BELOW THIS LINE
',
'Base template for GUI/Selenium test scripts', 1),

('Performance', 'Default Performance Template',
'*** Settings ***
Library    RequestsLibrary
Library    Process
Library    Collections
Library    DateTime

*** Variables ***
${BASE_URL}       %{BASE_URL}
${TARGET_RPS}     100
${DURATION_SEC}   60
${THRESHOLD_MS}   500

*** Keywords ***
Measure Response Time
    [Arguments]    ${session}    ${endpoint}
    ${start}=      Get Current Date    result_format=epoch
    ${response}=   GET On Session    ${session}    ${endpoint}
    ${end}=        Get Current Date    result_format=epoch
    ${elapsed}=    Evaluate    (${end} - ${start}) * 1000
    [Return]       ${elapsed}

Assert SLA
    [Arguments]    ${actual_ms}    ${threshold}=${THRESHOLD_MS}
    Should Be True    ${actual_ms} < ${threshold}
    ...    Response ${actual_ms}ms exceeded SLA of ${threshold}ms

*** Test Cases ***
# AGENT GENERATES CASES BELOW THIS LINE
',
'Base template for performance test scripts', 1);
