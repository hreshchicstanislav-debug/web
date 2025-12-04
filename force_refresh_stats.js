// Скрипт для принудительного обновления статистики Asana
// Использование: откройте консоль браузера (F12) на странице с вкладкой "Задачи" и выполните:
// 
// 1. Скопируйте весь этот файл в консоль
// 2. Или выполните: await forceRefreshAsanaStats()

async function forceRefreshAsanaStats() {
  try {
    console.log('🔄 Начинаю принудительное обновление статистики Asana...');
    
    if (!supabaseClient) {
      console.error('❌ Supabase клиент не инициализирован');
      return null;
    }

    // Вызываем Edge Function для обновления данных
    console.log('📡 Вызываю Edge Function fetch-asana-stats...');
    const { data, error } = await supabaseClient.functions.invoke('fetch-asana-stats', {
      body: {}
    });

    if (error) {
      console.error('❌ Ошибка при вызове Edge Function:', error);
      return null;
    }

    if (!data || !data.success) {
      console.error('❌ Edge Function вернула ошибку:', data?.error || 'Unknown error');
      return null;
    }

    console.log('✅ Edge Function выполнена успешно');
    console.log('📊 Полученные данные:', data.data);

    // Проверяем ключевые показатели
    const stats = data.data;
    console.log('\n📈 Ключевые показатели:');
    console.log('  - Уже на руках (on_hand_qty):', stats.on_hand_qty ?? 0);
    console.log('  - Сфоткано, но не обработано (shot_not_processed_qty):', stats.shot_not_processed_qty ?? 0);
    console.log('  - Сделано (done_qty):', stats.done_qty ?? 0);
    console.log('  - Факт недели (done_fact_this_week):', stats.done_fact_this_week ?? 0);
    console.log('  - Версия Edge Function:', stats.version || 'unknown');

    // Обновляем UI
    if (typeof updateTasksCards === 'function') {
      console.log('\n🔄 Обновляю карточки в UI...');
      updateTasksCards(stats);
      console.log('✅ UI обновлён');
    } else {
      console.warn('⚠️ Функция updateTasksCards не найдена. Перезагрузите страницу для обновления UI.');
    }

    // Проверяем логику on_hand_qty
    if (stats.on_hand_qty > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: on_hand_qty > 0. Проверьте, что Edge Function обновлена с условием !task.shot_at');
      console.log('   Если товары сфотографированы (shot_at заполнено), они НЕ должны попадать в "Уже на руках"');
    }

    return stats;
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики:', error);
    return null;
  }
}

// Делаем функцию доступной глобально
window.forceRefreshAsanaStats = forceRefreshAsanaStats;

console.log('✅ Функция forceRefreshAsanaStats() загружена. Вызовите: await forceRefreshAsanaStats()');

