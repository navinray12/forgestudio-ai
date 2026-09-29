<?php
// Runs only in the ephemeral CI container. No credential is printed or reused.
if (getenv('WORDPRESS_DB_NAME') !== 'wordpress' || getenv('GITHUB_ACTIONS') !== 'true') {
    fwrite(STDERR, "Disposable WordPress fixture guard failed\n"); exit(1);
}
define('WP_INSTALLING', true);
require '/var/www/html/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_blog_installed()) {
    wp_install('Forge regression fixture', 'fixture_admin', 'fixture@example.test', true, '', bin2hex(random_bytes(24)));
}
update_option('home', 'http://localhost:8000');
update_option('siteurl', 'http://localhost:8000');
update_option('permalink_structure', '/%postname%/');
$result = activate_plugin('forgestudio-connector/forgestudio-connector.php');
if (is_wp_error($result)) { fwrite(STDERR, "Connector activation failed\n"); exit(1); }
global $wp_rewrite;
$wp_rewrite->set_permalink_structure('/%postname%/');
$wp_rewrite->flush_rules(true);
echo "Disposable WordPress and connector installed\n";
