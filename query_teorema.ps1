$conn = New-Object System.Data.Odbc.OdbcConnection
$conn.ConnectionString = "DSN=Teorema"
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT RDB`$RELATION_NAME FROM RDB`$RELATIONS WHERE RDB`$SYSTEM_FLAG=0 AND RDB`$VIEW_BLR IS NULL"
    $reader = $cmd.ExecuteReader()
    $tables = @()
    while ($reader.Read()) {
        $tables += $reader.GetString(0).Trim()
    }
    $reader.Close()
    $conn.Close()
    
    $tables | Out-File "teorema_tables.txt"
    Write-Host "Tables exported to teorema_tables.txt"
} catch {
    Write-Host "Error: $_"
}
