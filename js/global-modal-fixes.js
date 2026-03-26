// js/global-modal-fixes.js v3
(function() {
  'use strict';
  
  console.log('[ModalFix] Loading robust async modal controller.');

  /**
   * Safely shows a modal. Returns a promise that resolves with the modal instance
   * once the modal is fully shown. It prevents race conditions by waiting for
   * transitions to complete.
   * @param {string} modalId The ID of the modal to show.
   * @param {object} options Options to pass to the Bootstrap modal constructor.
   * @returns {Promise<bootstrap.Modal|null>}
   */
  window.safeShowModal = function(modalId, options = {}) {
    return new Promise((resolve) => {
      const el = document.getElementById(modalId);
      if (!el) {
        console.error(`[ModalFix] Modal element #${modalId} not found.`);
        return resolve(null);
      }

      let modal = bootstrap.Modal.getInstance(el);
      if (!modal) {
        modal = new bootstrap.Modal(el, options);
      }

      // If the modal is already visible, resolve immediately.
      if (el.classList.contains('show')) {
        return resolve(modal);
      }

      const onShown = () => {
        resolve(modal);
      };

      // This event fires after the show transition completes.
      el.addEventListener('shown.bs.modal', onShown, { once: true });

      // If the modal is in the middle of a hide transition, Bootstrap's `show`
      // command will be queued and will execute after `hide` is done.
      // This is standard Bootstrap behavior and should be safe.
      modal.show();
    });
  };

  /**
   * Safely hides a modal. Returns a promise that resolves once the modal
   * is fully hidden.
   * @param {string} modalId The ID of the modal to hide.
   * @returns {Promise<void>}
   */
  window.safeHideModal = function(modalId) {
    return new Promise((resolve) => {
      const el = document.getElementById(modalId);
      if (!el) {
        // If element doesn't exist, it's not visible.
        return resolve();
      }

      const modal = bootstrap.Modal.getInstance(el);
      if (!modal || !el.classList.contains('show')) {
        // If no instance or not visible, it's already "hidden".
        return resolve();
      }

      const onHidden = () => {
        resolve();
      };
      
      // This event fires after the hide transition completes.
      el.addEventListener('hidden.bs.modal', onHidden, { once: true });
      
      modal.hide();
    });
  };

})();
