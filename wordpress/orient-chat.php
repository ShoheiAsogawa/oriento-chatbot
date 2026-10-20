<?php
/**
 * 予備ファイル。通常は使わない。
 * テーマの functions.php は編集せず、プラグイン
 * wordpress/orient-orinyan-chat を有効化してください。
 */
if (!defined('ABSPATH')) {
  exit;
}

add_action('wp_enqueue_scripts', static function () {
  if (is_admin()) {
    return;
  }

  wp_enqueue_script(
    'cloudflare-turnstile',
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    [],
    null,
    true
  );
  wp_enqueue_script(
    'orient-chat',
    'https://orient-chat-api.uken-shohei.workers.dev/widget/orient-chat.js',
    ['cloudflare-turnstile'],
    '20260830-1',
    true
  );
});

add_action('wp_footer', static function () {
  if (is_admin()) {
    return;
  }
  ?>
  <orient-chat
    api-url="https://orient-chat-api.uken-shohei.workers.dev"
    primary-color="#ff680b"
    ink-color="#29293a"
    character-src="https://orient-chat-api.uken-shohei.workers.dev/assets/orinyan-states.png"
    turnstile-site-key="0x4AAAAAAELFZjpF4XsO2kRC"
    line-url="https://page.line.me/089wmudt"
    contact-url="https://orijyu.com/reception.html"
    avoid-selector="#click_to_call_bar, .ctc_bar"
  ></orient-chat>
  <?php
}, 99);
