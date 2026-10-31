<?php
$db_host = 'localhost';
$db_user = 'root';
$db_pass = '';
$db_name = 'grade_opening_system';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    
    $pass123 = password_hash('pass123', PASSWORD_DEFAULT);
    $dean123 = password_hash('dean123', PASSWORD_DEFAULT);
    $vpaa123 = password_hash('vpaa123', PASSWORD_DEFAULT);
    $cict123 = password_hash('cict123', PASSWORD_DEFAULT);

    $pdo->prepare("UPDATE users SET p = ? WHERE role = 'instructor'")->execute([$pass123]);
    $pdo->prepare("UPDATE users SET p = ? WHERE role = 'dean'")->execute([$dean123]);
    $pdo->prepare("UPDATE users SET p = ? WHERE role = 'vpaa'")->execute([$vpaa123]);
    $pdo->prepare("UPDATE users SET p = ? WHERE role = 'cict'")->execute([$cict123]);

    echo "<h3>Success! All passwords have been correctly hashed and updated.</h3>";
    echo "<p>You can now delete this <code>fix_passwords.php</code> file and <a href='index.html'>go back to log in</a>.</p>";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>